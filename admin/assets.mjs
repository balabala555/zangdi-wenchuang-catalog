// Private immutable uploads; no source file is served to the customer or admin media route.
import fs from 'node:fs';

import {atStage} from './diagnostics.mjs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {brandConfig} from '../src/brand.js';
import {optimizedPhotos} from '../src/generated-images.js';
import {codeRoot,StoreError} from './store.mjs';
export const assetPattern=/^asset:[a-f0-9]{64}$/;
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const photoTemplate={version:'unwatermarked-product-v1',position:'none',text:'',contacts:[],edge:1600,thumb:240,quality:90};
const fileNames=['meta.json','original.jpg','original.png','original.webp','detail.webp','thumb.webp','fallback.jpg'];
let engine,recipe;
async function tools(){
 try{engine||=(await import('sharp')).default;}catch(cause){const error=new StoreError(503,'本地图片组件未就绪，请关闭后台后重新双击07。');error.cause=cause;throw error;}
 recipe||=JSON.stringify({...photoTemplate,processor:sha(fs.readFileSync(new URL(import.meta.url)))});return engine;
}
export function assetPath(root,ref){if(!assetPattern.test(ref))throw new StoreError(400,'照片编号无效');return path.join(root,'assets',ref.slice(6));}
export function assetMeta(root,ref,verify=false){const dir=assetPath(root,ref);let meta;try{meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));}catch{throw new StoreError(409,'照片资料缺失或损坏，请从完整ZIP备份恢复。');}
 if(meta.id!==ref||meta.version!==1||!meta.files||!meta.original||!['original.jpg','original.png','original.webp'].includes(meta.original)||Object.keys(meta.files).some(f=>!fileNames.includes(f)||f==='meta.json')||!['detail.webp','thumb.webp','fallback.jpg',meta.original].every(f=>meta.files[f]))throw new StoreError(400,'照片登记格式无效');
 if(!/^[a-f0-9]{64}$/.test(meta.sourceSha256)||meta.sourceSha256!==meta.files[meta.original].sha256||sha(meta.sourceSha256+JSON.stringify(meta.recipe))!==ref.slice(6)||!['unwatermarked-product-v1','corner-brand-v1','distributed-brand-v1','distributed-brand-v2-soft'].includes(meta.recipe?.version)||meta.recipe?.text!==(meta.recipe?.version==='unwatermarked-product-v1'?'':brandConfig.name)||meta.recipe?.position!==(meta.recipe?.version==='unwatermarked-product-v1'?'none':meta.recipe?.version==='corner-brand-v1'?'bottom-right':'distributed')||Object.keys(meta.files).length!==4)throw new StoreError(400,'原图与展示图登记不一致');
 for(const info of Object.values(meta.files))if(!Number.isSafeInteger(info.bytes)||info.bytes<1||info.bytes>25*1024**2||!/^[a-f0-9]{64}$/.test(info.sha256))throw new StoreError(400,'照片文件描述无效');
 if(verify)for(const [name,info]of Object.entries(meta.files)){const b=fs.readFileSync(path.join(dir,name));if(b.length!==info.bytes||sha(b)!==info.sha256)throw new StoreError(409,'照片完整性校验失败，未覆盖原文件');}
 return meta;
}
export class PhotoLibrary{
 constructor(root){this.root=root;this.pending=new Map();fs.mkdirSync(path.join(root,'assets'),{recursive:true});fs.mkdirSync(path.join(root,'incoming'),{recursive:true});}
 list(){return fs.readdirSync(path.join(this.root,'assets')).filter(n=>/^[a-f0-9]{64}$/.test(n)).map(n=>assetMeta(this.root,'asset:'+n));}
 async upload(file,name){let step='photo-read';try{const bytes=fs.readFileSync(file),sourceSha=sha(bytes);
  step='photo-library';const processed=new Set(Object.values(optimizedPhotos).flatMap(p=>[p.public,p.thumb,p.card,p.detail,...(p.legacy||[])]).map(p=>p.sha256));for(const m of this.list())for(const [n,entry]of Object.entries(m.files))if(n!==m.original)processed.add(entry.sha256);
  if(processed.has(sourceSha))throw new StoreError(400,'这是本系统已处理的展示图，请选择原始实拍照片，请使用私有原图，避免把旧水印当作实拍内容。');
  const supported=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!supported)throw new StoreError(400,'目前支持JPG、PNG、WebP；HEIC等格式请先导出兼容照片。');step='photo-tools';const sharp=await tools();step='photo-inspect';const meta=await sharp(bytes,{limitInputPixels:40000000,animated:false}).metadata().catch(()=>{throw new StoreError(400,'照片无法读取，请使用真实的JPG、PNG或WebP照片。');});
  if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1||!meta.width||!meta.height||meta.width<32||meta.height<32||meta.width*meta.height>40000000)throw new StoreError(400,'目前支持单张JPG、PNG、WebP；不支持HEIC、SVG或动画，请先导出兼容格式。');
  const ref='asset:'+sha(sourceSha+recipe);if(fs.existsSync(assetPath(this.root,ref)))return {ref,meta:assetMeta(this.root,ref,true),reused:true};
  if(this.pending.has(ref))return await this.pending.get(ref);
  const work=this.generate(ref,bytes,name,meta,sharp).finally(()=>this.pending.delete(ref));this.pending.set(ref,work);return await work;
  }catch(error){throw atStage(error,step);}
 }
 async generate(ref,bytes,name,source,sharp){
  const stage=path.join(this.root,'assets','.pending-'+randomUUID());let step='photo-original';
  try{fs.mkdirSync(stage);
   const original='original.'+(source.format==='jpeg'?'jpg':source.format);fs.writeFileSync(path.join(stage,original),bytes,{flag:'wx',mode:0o600});
   const info={version:1,id:ref,sourceSha256:sha(bytes),original,originalName:String(name||'上传照片').slice(0,240),createdAt:new Date().toISOString(),recipe:JSON.parse(recipe),files:{[original]:{bytes:bytes.length,sha256:sha(bytes)}},renditions:{}};
   for(const [size,max]of [['detail',photoTemplate.edge],['thumb',photoTemplate.thumb]]){
    step='photo-resize';const base=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).withIccProfile('srgb').png().toBuffer({resolveWithObject:true});const {width:w,height:h}=base.info;
    const marked=base.data,mark={layers:0,groups:0,positions:[],policy:'unwatermarked-product-v1'};step='photo-webp';const output=await sharp(marked).webp({quality:photoTemplate.quality,effort:4}).toBuffer();fs.writeFileSync(path.join(stage,size+'.webp'),output,{flag:'wx',mode:0o600});info.files[size+'.webp']={bytes:output.length,sha256:sha(output)};info.renditions[size]={width:w,height:h,mark};
    if(size==='detail'){step='photo-jpeg';const jpg=await sharp(marked).flatten({background:'#f7f5ef'}).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer();fs.writeFileSync(path.join(stage,'fallback.jpg'),jpg,{flag:'wx',mode:0o600});info.files['fallback.jpg']={bytes:jpg.length,sha256:sha(jpg)};}
   }
   step='photo-metadata';fs.writeFileSync(path.join(stage,'meta.json'),JSON.stringify(info,null,2),{flag:'wx',mode:0o600});
   // Windows FlushFileBuffers requires a writable handle. Never truncate or rewrite bytes.
   step='photo-sync';for(const f of fs.readdirSync(stage)){const fd=fs.openSync(path.join(stage,f),'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
   step='photo-finalize';fs.renameSync(stage,assetPath(this.root,ref));return {ref,meta:info,reused:false};
  }catch(error){try{fs.rmSync(stage,{recursive:true,force:true});}catch{/* Keep a failed private staging folder if cleanup is blocked; preserve the original error. */}throw atStage(error,step);}
 }
 media(ref,size='thumb'){const m=assetMeta(this.root,ref);if(m.recipe.version!=='unwatermarked-product-v1')return import('./product-images.mjs').then(m=>m.productPhoto(this.root,ref,size));const file=size==='detail'?'detail.webp':'thumb.webp',bytes=fs.readFileSync(path.join(assetPath(this.root,ref),file));if(sha(bytes)!==m.files[file].sha256)throw new StoreError(409,'展示图校验失败，未展示原图');return bytes;}
 validateRefs(refs){for(const ref of new Set(refs))if(assetPattern.test(ref))assetMeta(this.root,ref,true);}
}
