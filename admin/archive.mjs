// Streaming ZIPs: no paid service, no raw photos in Git, no archive path extraction shortcuts.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {optimizedPhotos} from '../src/generated-images.js';
import {codeRoot,categories,StoreError,unpack,validatePayload} from './store.mjs';
import {assetPattern,assetPath,assetMeta,sha} from './assets.mjs';
const legacy=new Map(Object.values(optimizedPhotos).flatMap(p=>[p.public,p.thumb,p.card,p.detail]).map(p=>[p.path,p]));
const safe=name=>name.length<240&&!name.includes('\\')&&!name.split('/').some(p=>p==='..'||p==='.'||!p)&&!name.includes(':')&&!name.startsWith('/');
const allowed=name=>['catalog.json','categories.json'].includes(name)||/^snapshots\/\d{10}-[a-f0-9-]{36}\.json$/.test(name)||/^assets\/[a-f0-9]{64}\/(meta\.json|original\.(jpg|png|webp)|detail\.webp|thumb\.webp|fallback\.jpg)$/.test(name)||name.startsWith('legacy/display/public/images/')&&legacy.has(name.slice('legacy/display/'.length))||name.startsWith('legacy/originals/public/images/')&&Object.hasOwn(optimizedPhotos,name.slice('legacy/originals/'.length));
const refs=p=>[...new Set([...p.products,...(p.publication?.products||[])].flatMap(r=>[r.photos.cover,...r.photos.common,...Object.values(r.photos.variants).flat()]).filter(Boolean))];
export class ArchiveService{
 constructor(store,photos){this.store=store;this.photos=photos;this.jobs=new Map();this.plans=new Map();fs.mkdirSync(path.join(store.dir,'backups'),{recursive:true});}
 legacyFile(file){const restored=path.join(this.store.dir,'legacy-media',file);return fs.existsSync(restored)?restored:path.join(codeRoot,file);}
 coverage(){const assets=this.photos.list();const missing=[];for(const [source,p]of Object.entries(optimizedPhotos)){const locations=[path.join(this.store.dir,'legacy-originals',source),path.join(codeRoot,'.private-originals',source.slice('public/images/'.length)),...assets.filter(m=>m.sourceSha256===p.sourceSha256).map(m=>path.join(assetPath(this.store.dir,m.id),m.original))];if(!locations.some(f=>fs.existsSync(f)&&sha(fs.readFileSync(f))===p.sourceSha256))missing.push(source);}return {uploaded:assets.length,missingLegacyOriginals:missing};}
 start(revision){if([...this.jobs.values()].some(j=>j.state==='working'))throw new StoreError(409,'正在生成完整备份，请等待完成');const current=this.store.read();if(current.revision!==revision)throw new StoreError(409,'商品资料已更新，请刷新后生成备份');const id=randomUUID(),job={id,state:'working',completed:0,total:0,phase:'收集资料',revision};this.jobs.set(id,job);this.build(job).then(()=>job.state='done').catch(error=>{job.state='error';job.error=error.message;});return {job:id};}
 async build(job){
  const yazl=(await import('yazl')).default;
  const entries=[],buffers=new Map(),addBuffer=(name,value)=>{const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2));buffers.set(name,bytes);entries.push({name,bytes:bytes.length,sha256:sha(bytes)});};
  const current=this.store.download();if(current.payload.revision!==job.revision)throw new StoreError(409,'资料已变化，请重新生成完整备份');addBuffer('catalog.json',current);addBuffer('categories.json',categories);
  for(const file of this.store.names()){const bytes=fs.readFileSync(path.join(this.store.snapshots,file));unpack(bytes);addBuffer('snapshots/'+file,bytes.toString());}
  const assets=this.photos.list(),assetIds=[];
  for(const m of assets){assetIds.push(m.id);const base=assetPath(this.store.dir,m.id),meta=fs.readFileSync(path.join(base,'meta.json'));addBuffer('assets/'+m.id.slice(6)+'/meta.json',meta.toString());for(const [file,info]of Object.entries(m.files))entries.push({name:'assets/'+m.id.slice(6)+'/'+file,...info,source:path.join(base,file)});}
  for(const [file,info]of legacy)entries.push({name:'legacy/display/'+file,...info,source:this.legacyFile(file)});
  const missing=[];for(const [source,p]of Object.entries(optimizedPhotos)){
   const candidates=[path.join(this.store.dir,'legacy-originals',source),path.join(codeRoot,'.private-originals',source.slice('public/images/'.length)),...assets.filter(m=>m.sourceSha256===p.sourceSha256).map(m=>path.join(assetPath(this.store.dir,m.id),m.original))];
   const original=candidates.find(f=>fs.existsSync(f)&&sha(fs.readFileSync(f))===p.sourceSha256);if(original)entries.push({name:'legacy/originals/'+source,source:original,bytes:fs.statSync(original).size,sha256:p.sourceSha256});else missing.push(source);
  }
  const manifest={format:'zangdi-full-backup-v1',createdAt:new Date().toISOString(),revision:current.payload.revision,files:entries.map(({name,bytes,sha256})=>({name,bytes,sha256})),assetIds,missingLegacyOriginals:missing};
  const target=path.join(this.store.dir,'backups',job.id+'.zip'),partial=target+'.partial',zip=new yazl.ZipFile();job.total=entries.length;job.phase='打包原图与展示图';job.missingLegacyOriginals=missing;
  zip.on('error',error=>zip.outputStream.destroy(error));const output=fs.createWriteStream(partial,{flags:'wx',mode:0o600});const done=pipeline(zip.outputStream,output);
  for(const e of entries){
   if(buffers.has(e.name)){zip.addBuffer(buffers.get(e.name),e.name);job.completed++;}
   else zip.addReadStreamLazy(e.name,{size:e.bytes,compress:false},cb=>{
    const digest=createHash('sha256');let count=0;const check=new Transform({transform(chunk,encoding,next){digest.update(chunk);count+=chunk.length;next(null,chunk);},flush(next){if(count!==e.bytes||digest.digest('hex')!==e.sha256)return next(Error('备份源文件校验失败：'+e.name));job.completed++;next();}});
    const source=fs.createReadStream(e.source);source.on('error',error=>check.destroy(error));check.on('error',error=>zip.outputStream.destroy(error));source.pipe(check);cb(null,check);
   });
  }
  zip.addBuffer(Buffer.from(JSON.stringify(manifest,null,2)),'backup-manifest.json');zip.end();
  try{await done;fs.renameSync(partial,target);job.bytes=fs.statSync(target).size;job.phase='备份完成';job.download='/api/backup/full/download/'+job.id;}catch(error){if(fs.existsSync(partial))fs.unlinkSync(partial);throw error;}
 }
 async check(file){
  const yauzl=(await import('yauzl')).default;
  const stage=path.join(this.store.dir,'incoming','restore-'+randomUUID());fs.mkdirSync(stage,{recursive:true});const entries=new Map();let count=0,total=0;
  try{
   const zip=await new Promise((resolve,reject)=>yauzl.open(file,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true},(e,z)=>e?reject(e):resolve(z)));
   await new Promise((resolve,reject)=>{let stopped=false;const fail=e=>{if(stopped)return;stopped=true;zip.close();reject(e);};zip.on('error',fail);zip.on('end',resolve);zip.on('entry',entry=>{(async()=>{
    const name=entry.fileName;if(++count>50000||!safe(name)||name!=='backup-manifest.json'&&!allowed(name)||(entry.externalFileAttributes>>>16&0xf000)===0xa000||entries.has(name.toLowerCase()))throw Error('ZIP包含不安全、重复或不支持的路径');
    total+=entry.uncompressedSize;if(total>24*1024**3||entry.uncompressedSize>128*1024**2)throw Error('ZIP解压后超过安全大小限制');const destination=path.join(stage,name);fs.mkdirSync(path.dirname(destination),{recursive:true});
    const source=await new Promise((r,j)=>zip.openReadStream(entry,(e,s)=>e?j(e):r(s)));const digest=createHash('sha256');let size=0;const check=new Transform({transform(c,_,next){size+=c.length;if(size>entry.uncompressedSize)return next(Error('ZIP文件长度不符'));digest.update(c);next(null,c);}});await pipeline(source,check,fs.createWriteStream(destination,{flags:'wx',mode:0o600}));entries.set(name.toLowerCase(),{name,bytes:size,sha256:digest.digest('hex')});zip.readEntry();})().catch(fail);});zip.readEntry();});
   const manifest=JSON.parse(fs.readFileSync(path.join(stage,'backup-manifest.json')));if(manifest.format!=='zangdi-full-backup-v1'||!Array.isArray(manifest.files)||manifest.files.length!==entries.size-1)throw Error('完整备份清单不完整');const seen=new Set();for(const item of manifest.files){if(!safe(item.name)||!allowed(item.name)||seen.has(item.name))throw Error('完整备份清单路径无效');seen.add(item.name);const actual=entries.get(item.name.toLowerCase());if(!actual||actual.name!==item.name||actual.bytes!==item.bytes||actual.sha256!==item.sha256)throw Error('备份文件完整性校验失败：'+item.name);}
   const payload=unpack(fs.readFileSync(path.join(stage,'catalog.json'))),savedCategories=JSON.parse(fs.readFileSync(path.join(stage,'categories.json')));if(!Array.isArray(savedCategories)||payload.products.some(p=>!savedCategories.includes(p.category)))throw Error('商品分类清单无效');
   const historical=[];for(const item of manifest.files)if(item.name.startsWith('snapshots/')){const p=unpack(fs.readFileSync(path.join(stage,item.name)));if(p.revision!==Number(item.name.split('/')[1].slice(0,10)))throw Error('历史快照版本编号不符');historical.push(p);}
   if(!Array.isArray(manifest.assetIds)||new Set(manifest.assetIds).size!==manifest.assetIds.length||manifest.files.some(e=>e.name.startsWith('assets/')&&!manifest.assetIds.includes('asset:'+e.name.split('/')[1])))throw Error('照片清单不完整或重复');const archiveAssetRoot=stage;for(const ref of manifest.assetIds||[])assetMeta(archiveAssetRoot,ref,true);for(const ref of new Set([payload,...historical].flatMap(refs)))if(assetPattern.test(ref)&&!manifest.assetIds?.includes(ref))throw Error('备份缺少商品关联照片');
   for(const [name,expected]of legacy){const entry=entries.get(('legacy/display/'+name).toLowerCase());if(!entry||entry.sha256!==expected.sha256)throw Error('缺少或改变了已验证的旧商品保护图');}
   for(const item of manifest.files)if(item.name.startsWith('legacy/originals/')){const source=item.name.slice('legacy/originals/'.length);if(item.sha256!==optimizedPhotos[source]?.sourceSha256)throw Error('旧商品原图指纹不符');}
   const token=randomUUID();this.plans.set(token,{stage,payload,manifest,fingerprint:this.store.fingerprint(),createdAt:Date.now()});return {token,count:payload.products.length,assets:manifest.assetIds?.length||0,revision:payload.revision,expectedFingerprint:this.store.fingerprint(),missingLegacyOriginals:manifest.missingLegacyOriginals||[]};
  }catch(error){fs.rmSync(stage,{recursive:true,force:true});throw new StoreError(400,'完整ZIP未通过校验，商品库未改变：'+(/invalid relative path|invalid characters|absolute path/i.test(error.message)?'包含不安全的文件路径':error.message));}finally{if(fs.existsSync(file))fs.unlinkSync(file);}
 }
 async restore({token,confirm,expectedFingerprint}){
  if(confirm!==true)throw new StoreError(400,'请先确认恢复范围');const plan=this.plans.get(token);if(!plan||Date.now()-plan.createdAt>60*60*1000)throw new StoreError(400,'校验会话已失效，请重新选择ZIP');
  return this.store.locked(async()=>{
   if(this.store.fingerprint()!==expectedFingerprint||plan.fingerprint!==expectedFingerprint)throw new StoreError(409,'校验后商品库已发生变化，请重新校验ZIP，未覆盖新资料');
   const moves=[],quarantine=path.join(this.store.dir,'recovery-records','zip-'+randomUUID());fs.mkdirSync(quarantine,{recursive:true});try{fs.writeFileSync(path.join(quarantine,'catalog-before.json'),JSON.stringify(this.store.download(),null,2),{mode:0o600});}catch{if(fs.existsSync(this.store.pointer))fs.copyFileSync(this.store.pointer,path.join(quarantine,'CURRENT.corrupt'));}
   try{
    // Recheck immutable staged bytes before importing anything.
    for(const e of plan.manifest.files){const bytes=fs.readFileSync(path.join(plan.stage,e.name));if(bytes.length!==e.bytes||sha(bytes)!==e.sha256)throw Error('校验后的临时文件发生变化');}
    for(const ref of plan.manifest.assetIds||[]){const source=assetPath(plan.stage,ref),target=assetPath(this.store.dir,ref);let same=false;try{const a=assetMeta(this.store.dir,ref,true),b=assetMeta(plan.stage,ref,true);same=JSON.stringify(a.files)===JSON.stringify(b.files);}catch{}
     if(same)continue;let old;if(fs.existsSync(target)){old=path.join(quarantine,ref.slice(6));fs.renameSync(target,old);}moves.push({target,old});fs.cpSync(source,target,{recursive:true,errorOnExist:true,force:false});
    }
    for(const entry of plan.manifest.files.filter(e=>e.name.startsWith('legacy/'))){const isOriginal=entry.name.startsWith('legacy/originals/'),relative=entry.name.slice(isOriginal?'legacy/originals/'.length:'legacy/display/'.length),target=path.join(this.store.dir,isOriginal?'legacy-originals':'legacy-media',relative);if(fs.existsSync(target)){if(sha(fs.readFileSync(target))===entry.sha256)continue;const old=path.join(quarantine,randomUUID());fs.renameSync(target,old);moves.push({target,old});}else moves.push({target});fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(plan.stage,entry.name),target,fs.constants.COPYFILE_EXCL);}
    for(const entry of plan.manifest.files.filter(e=>e.name.startsWith('snapshots/'))){const source=path.join(plan.stage,entry.name);let target=path.join(this.store.snapshots,entry.name.split('/')[1]);if(fs.existsSync(target)){if(sha(fs.readFileSync(target))===entry.sha256)continue;target=path.join(this.store.snapshots,entry.name.split('/')[1].slice(0,11)+randomUUID()+'.json');}moves.push({target});fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);}
    validatePayload(plan.payload);const result=this.store.commit(this.store.preservePublished(plan.payload),'确认从完整ZIP恢复（旧资料与被替换文件均保留）');this.plans.delete(token);try{fs.rmSync(plan.stage,{recursive:true,force:true});}catch{/* Cleanup failure must not roll back photos after CURRENT has committed. */}return result;
   }catch(error){for(const {target,old}of moves.reverse()){if(fs.existsSync(target))fs.renameSync(target,path.join(quarantine,'failed-'+randomUUID()));if(old)fs.renameSync(old,target);}throw new StoreError(409,'恢复未完成，当前商品库及照片已保持/回退原状，保全资料在私有恢复目录：'+error.message);}
  });
 }
}
