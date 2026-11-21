// Private, append-only local catalogue. No public website or Git files are written.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {products} from '../src/data.js';
import {homeConfig} from '../src/homepage.js';
import {optimizedPhotos} from '../src/generated-images.js';
export const codeRoot=fileURLToPath(new URL('../',import.meta.url));
export const modernCategories=homeConfig.categories.map(c=>c.name);
export const categories=[...new Set([...modernCategories,...products.map(p=>p.category)])];
export const statuses={on_sale:'在售',sold_out:'售罄',off_sale:'下架'};
const hash=s=>createHash('sha256').update(s).digest('hex'),clone=x=>JSON.parse(JSON.stringify(x));
const snapshotName=/^\d{10}-[a-f0-9-]{36}\.json$/,idPattern=/^[a-z0-9][a-z0-9-]{0,100}$/;
const knownPhotos=new Set(Object.keys(optimizedPhotos));
export class StoreError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(message,status=400)=>{throw new StoreError(status,message);};
export function defaultDataDir(){return process.env.CATALOG_ADMIN_DATA_DIR||path.join(process.platform==='win32'?(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local')):path.join(os.homedir(),'.local','share'),'ZangdiCatalog','merchant-data');}
function realFuture(p){let base=path.resolve(p),tail=[];while(!fs.existsSync(base)){tail.unshift(path.basename(base));const parent=path.dirname(base);if(parent===base)fail('私有商品库所在磁盘或路径不可用，未写入资料。');base=parent;}return path.join(fs.realpathSync(base),...tail);}
export function validateDataDir(dir){const a=realFuture(dir),b=fs.realpathSync(codeRoot),inside=(x,y)=>{const r=path.relative(x,y);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};if(inside(b,a)||inside(a,b))fail('商品库必须放在网站项目之外的独立私有目录，未写入文件。');return a;}
function text(x,label,max=300,required=false){if(typeof x!=='string'||x.length>max||(required&&!x.trim()))fail(label+'填写不正确');return x.trim();}
export function cents(value){const s=String(value);if(!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(s))fail('价格必须是大于0、最多两位小数的金额');const [a,b='']=s.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));if(n<1)fail('价格必须大于0');return n;}
function imported(){return products.map(p=>{const variants=p.variants.map(name=>({id:'v-'+hash(p.id+'\0'+name).slice(0,20),name,aliases:[]}));return {id:p.id,name:p.name,category:p.category,priceCents:Math.round(p.price*100),unit:p.unit||'件',size:p.size||'',material:p.material||'',description:p.description||'',subtitle:p.subtitle||'',tag:p.tag||'',status:'on_sale',demo:p.demo!==false,variants,retiredVariants:[],photos:{cover:p.coverImage||p.image||null,common:p.images||[],variants:Object.fromEntries(variants.map(v=>[v.id,p.variantImages?.[v.name]||[]]))},updatedAt:new Date().toISOString()};});}
function validatePayload(p){
 if(!p||p.schemaVersion!==1||!Number.isSafeInteger(p.revision)||p.revision<1||!Array.isArray(p.products)||p.products.length>5000)fail('备份格式或版本不受支持');
 const ids=new Set();for(const r of p.products){
  if(!r||!idPattern.test(r.id)||ids.has(r.id))fail('商品编号无效或重复');ids.add(r.id);
  text(r.name,'商品名称',120,true);if(!categories.includes(r.category))fail('商品分类无效');if(!Number.isSafeInteger(r.priceCents)||r.priceCents<1||r.priceCents>9999999999)fail('商品价格无效');
  for(const key of ['subtitle','tag'])if(r[key]!==undefined)text(r[key],key,300);
  for(const [key,max]of [['unit',20],['size',500],['material',500],['description',5000]])text(r[key],key,max);
  if(!Object.hasOwn(statuses,r.status)||typeof r.demo!=='boolean')fail('商品状态无效');
  if(!Array.isArray(r.variants)||!r.variants.length||r.variants.length>100||!Array.isArray(r.retiredVariants))fail('款式数量无效');
  const variants=new Set(),names=new Set();for(const v of [...r.variants,...r.retiredVariants]){if(!v||!idPattern.test(v.id)||variants.has(v.id))fail('款式编号无效');variants.add(v.id);text(v.name,'款式名称',80,true);if(!Array.isArray(v.aliases)||v.aliases.some(a=>typeof a!=='string'||a.length>80))fail('款式历史名称无效');}
  for(const v of r.variants){if(names.has(v.name))fail('款式名称不能重复');names.add(v.name);}
  const photo=r.photos;if(!photo||!Array.isArray(photo.common)||!photo.variants||typeof photo.variants!=='object'||Array.isArray(photo.variants))fail('照片引用格式无效');
  for(const [key,list]of Object.entries(photo.variants)){if(!variants.has(key)||!Array.isArray(list))fail('款式照片对应关系无效');}
  const paths=[photo.cover,...photo.common,...Object.values(photo.variants).flat()].filter(x=>x!==null);if(paths.length>1000||paths.some(x=>!knownPhotos.has(x)&&!/^asset:[a-f0-9]{64}$/.test(x)))fail('备份引用了当前版本没有验证的照片；未读取任何私有路径');
  if(photo.order!==undefined&&(!Array.isArray(photo.order)||new Set(photo.order).size!==photo.order.length||photo.order.some(x=>!paths.includes(x))))fail('照片展示顺序无效');
 }
 return p;
}
function envelope(payload){validatePayload(payload);if(Buffer.byteLength(JSON.stringify(payload))>8*1024*1024)fail('商品资料超过基础版8MB上限，未覆盖原版本。请先导出资料备份，再评估扩容。');return {format:'zangdi-local-catalog-v1',sha256:hash(JSON.stringify(payload)),payload};}
function unpack(bytes){let e;try{e=JSON.parse(bytes);}catch{fail('备份文件无法读取');}if(!e||typeof e!=='object'||!e.payload||typeof e.payload!=='object'||e.format!=='zangdi-local-catalog-v1'||e.sha256!==hash(JSON.stringify(e.payload)))fail('备份校验失败，未恢复');return validatePayload(e.payload);}
function syncDir(dir){try{const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}catch{/* Windows may not support directory fsync. Files are synced before rename. */}}
function durable(file,bytes,replace=false){const tmp=file+'.tmp-'+randomUUID();let fd;try{fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;if(!replace&&fs.existsSync(file))fail('版本文件已存在，未覆盖',409);fs.renameSync(tmp,file);syncDir(path.dirname(file));}finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
export class CatalogStore{
 constructor(dir=defaultDataDir()){this.dir=validateDataDir(dir);this.snapshots=path.join(this.dir,'snapshots');fs.mkdirSync(this.snapshots,{recursive:true,mode:0o700});this.pointer=path.join(this.dir,'CURRENT');this.lock=path.join(this.dir,'write.lock');
  if(!fs.existsSync(this.pointer)&&!this.names().length)this.locked(()=>{if(!fs.existsSync(this.pointer)&&!this.names().length)this.commit({schemaVersion:1,revision:1,products:imported()},'首次导入现有商品');});
 }
 names(){return fs.readdirSync(this.snapshots).filter(n=>snapshotName.test(n)).sort();}
 fingerprint(){try{return hash(fs.readFileSync(this.pointer));}catch{return 'missing';}}
 locked(fn){
  const nonce=randomUUID(),candidate=path.join(this.dir,'.lock-'+nonce);durable(candidate,JSON.stringify({pid:process.pid,nonce}));
  try{fs.linkSync(candidate,this.lock);}catch(error){fs.unlinkSync(candidate);if(error.code!=='EEXIST')throw error;let owner;try{owner=JSON.parse(fs.readFileSync(this.lock));}catch{fail('保存锁异常，未覆盖资料。请保留目录并联系维护人员检查。',409);}if(!Number.isInteger(owner.pid)||owner.pid<1)fail('保存锁格式异常，未覆盖资料',409);try{process.kill(owner.pid,0);fail('另一项保存正在进行，请稍后重试',409);}catch(e){if(e.code!=='ESRCH')throw e;}fs.renameSync(this.lock,this.lock+'.stale-'+randomUUID());return this.locked(fn);}
  fs.unlinkSync(candidate);const release=()=>{try{if(JSON.parse(fs.readFileSync(this.lock)).nonce===nonce)fs.unlinkSync(this.lock);}catch{}};try{const result=fn();if(result&&typeof result.then==='function')return result.finally(release);release();return result;}catch(error){release();throw error;}
 }
 read(){try{const ref=JSON.parse(fs.readFileSync(this.pointer));if(!snapshotName.test(ref.file))throw Error();const bytes=fs.readFileSync(path.join(this.snapshots,ref.file));if(hash(bytes)!==ref.sha256)throw Error();return unpack(bytes);}catch{throw new StoreError(503,'商品库校验失败；原文件没有被重建或覆盖。请打开“备份与恢复”选择有效快照。');}}
 commit(payload,operation){const max=this.names().reduce((n,f)=>Math.max(n,Number(f.slice(0,10))),0);if(max>=9999999999)fail('版本编号超过基础版上限，未写入资料');payload={...clone(payload),revision:max+1,updatedAt:new Date().toISOString(),operation};const bytes=JSON.stringify(envelope(payload),null,2),file=String(payload.revision).padStart(10,'0')+'-'+randomUUID()+'.json';durable(path.join(this.snapshots,file),bytes);durable(this.pointer,JSON.stringify({file,sha256:hash(bytes)}),true);return payload;}
 save(input,id,revision){return this.locked(()=>{const current=this.read();if(current.revision!==revision)fail('另一个窗口已经保存了新版本；请刷新后重新确认，当前编辑没有覆盖商品库。',409);const old=id&&current.products.find(p=>p.id===id);if(id&&!old)fail('商品不存在',404);
  if(!Object.hasOwn(statuses,input.status)||!categories.includes(input.category))fail('请选择有效的分类和状态');if(!modernCategories.includes(input.category)&&input.category!==old?.category)fail('请选择现有七大分类；历史分类只保留给原商品');
  const all=old?[...old.variants,...old.retiredVariants]:[],seen=new Set(),names=new Set();if(!Array.isArray(input.variants)||!input.variants.length||input.variants.length>100)fail('请至少填写一个款式，最多100个');
  const variants=input.variants.map(v=>{if(!v||typeof v!=='object')fail('款式填写不正确');const name=text(v.name,'款式名称',80,true);if(names.has(name))fail('款式名称不能重复');names.add(name);let previous=v.id?all.find(a=>a.id===v.id):all.find(a=>a.name===name);if(v.id&&!previous&&!/^v-[a-f0-9-]{36}$/.test(v.id))fail('款式编号无效，请刷新页面');const key=previous?.id||v.id||'v-'+randomUUID();if(seen.has(key))fail('款式编号不能重复');seen.add(key);return {id:key,name,aliases:[...new Set([...(previous?.aliases||[]),...(previous&&previous.name!==name?[previous.name]:[])])]};});
  const record={id:old?.id||'prod-'+randomUUID(),name:text(input.name,'商品名称',120,true),category:input.category,priceCents:cents(input.price),unit:text(input.unit||'个','计价单位',20,true),size:text(input.size??'','尺寸',500),material:text(input.material??'','材质',500),description:text(input.description??'','介绍',5000),subtitle:old?.subtitle||'',tag:old?.tag||'',status:input.status,demo:old?.demo||false,variants,retiredVariants:all.filter(v=>!seen.has(v.id)),photos:input.photos!==undefined?clone(input.photos):old?.photos||{cover:null,common:[],variants:{}},updatedAt:new Date().toISOString()};
  const next=clone(current);next.preferences={...(current.preferences||{}),lastCategory:modernCategories.includes(input.category)?input.category:current.preferences?.lastCategory||modernCategories[0]};if(old)next.products[next.products.findIndex(p=>p.id===id)]=record;else next.products.push(record);return this.commit(next,(old?'编辑商品：':'新增商品：')+record.name);
 });}
 preparePhase2(){const dir=path.join(this.dir,'phase2-upgrade');if(fs.existsSync(path.join(dir,'catalog-before.json')))return;return this.locked(()=>{if(fs.existsSync(path.join(dir,'catalog-before.json')))return;const bytes=JSON.stringify(this.download(),null,2);fs.mkdirSync(dir,{recursive:true});durable(path.join(dir,'catalog-before.json'),bytes);durable(path.join(dir,'CURRENT.before'),fs.readFileSync(this.pointer));});}
 setStatus(id,status,revision){return this.locked(()=>{const p=this.read();if(p.revision!==revision)fail('商品库已更新，请刷新后重试',409);if(!Object.hasOwn(statuses,status))fail('商品状态无效');const item=p.products.find(x=>x.id===id);if(!item)fail('商品不存在',404);if(item.status===status)return p;item.status=status;item.updatedAt=new Date().toISOString();return this.commit(p,'快捷状态：'+item.name+' → '+statuses[status]);});}
 backup(revision){return this.locked(()=>{const p=this.read();if(p.revision!==revision)fail('商品库已更新，请刷新后再备份',409);return this.commit(p,'手动备份');});}
 list(){let active;try{active=JSON.parse(fs.readFileSync(this.pointer)).file;}catch{}let invalid=0;const items=[];for(const file of this.names().reverse()){try{const p=unpack(fs.readFileSync(path.join(this.snapshots,file)));items.push({file,revision:p.revision,time:p.updatedAt,count:p.products.length,operation:p.operation,active:file===active});}catch{invalid++;}}return {items,invalid};}
 download(){return envelope(this.read());}
 restore({file,backup,expectedFingerprint,confirm}){if(confirm!==true)fail('请先明确确认恢复整个商品库');return this.locked(()=>{if(this.fingerprint()!==expectedFingerprint)fail('商品库在确认后发生变化，请刷新后重新选择恢复',409);let p;if(file){if(!snapshotName.test(file))fail('备份编号无效');if(!fs.existsSync(path.join(this.snapshots,file)))fail('找不到所选快照，原资料未改变',404);p=unpack(fs.readFileSync(path.join(this.snapshots,file)));}else p=unpack(JSON.stringify(backup));
  // Preserve the pointer bytes too when recovering from a corrupted pointer.
  if(fs.existsSync(this.pointer)){fs.mkdirSync(path.join(this.dir,'recovery-records'),{recursive:true});durable(path.join(this.dir,'recovery-records',randomUUID()+'.pointer'),fs.readFileSync(this.pointer));}
  return this.commit(p,'确认恢复商品库（旧版本继续保留）');});}
}

export {envelope,unpack,validatePayload,durable};
