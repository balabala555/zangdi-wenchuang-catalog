// Read-only adapter for the ORIGINAL customer website. No initialization, migration, copies or publishing.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
import {createServer} from '../server.js';import {defaultDataDir,validateDataDir,unpack,StoreError,modernCategories} from './store.mjs';import {assetPattern,assetMeta,PhotoLibrary} from './assets.mjs';import {optimizedPhotos} from '../src/generated-images.js';
const digest=b=>createHash('sha256').update(b).digest('hex');
export function localCatalogueReader(dataDir=defaultDataDir()){
 const dir=validateDataDir(dataDir),allowed=new Set();
 // Do not instantiate CatalogStore/PhotoLibrary: their constructors create folders.
 const photo=ref=>{if(!ref)return null;if(assetPattern.test(ref)){assetMeta(dir,ref);allowed.add(ref);return 'public/images/local-preview/'+ref.slice(6)+'.webp';}if(Object.hasOwn(optimizedPhotos,ref))return ref;throw new StoreError(409,'商品照片引用不受支持，请在后台检查；没有修改商品库。');};
 return {read(){let pointer,bytes;try{pointer=JSON.parse(fs.readFileSync(path.join(dir,'CURRENT')));if(!/^\d{10}-[a-f0-9-]{36}\.json$/.test(pointer.file))throw Error();bytes=fs.readFileSync(path.join(dir,'snapshots',pointer.file));if(digest(bytes)!==pointer.sha256)throw Error();}catch{throw new StoreError(409,'本机商品库不存在或校验失败。请先用07核对资料；预览不会新建或重置商品库。');}
 const payload=unpack(bytes),products=payload.products.filter(p=>!p.trashedAt&&!p.demo&&p.status==='on_sale').map((p,index)=>({p,index})).sort((a,b)=>modernCategories.indexOf(a.p.category)-modernCategories.indexOf(b.p.category)||Number(!!b.p.pinned)-Number(!!a.p.pinned)||a.index-b.index).map(({p})=>{
 const variants=p.variants.filter(v=>(v.status||p.status)==='on_sale');if(!variants.length)return null;
 return {id:p.id,name:p.name,category:p.category,price:p.priceCents/100,unit:p.unit,size:p.size,material:p.material,description:p.description,subtitle:p.subtitle||'',tag:p.tag||'',demo:false,localManaged:true,strictVariantPhotos:true,variants:variants.map(v=>v.name),variantPrices:Object.fromEntries(variants.map(v=>[v.name,(v.priceCents??p.priceCents)/100])),variantIds:Object.fromEntries(variants.map(v=>[v.name,v.id])),coverImage:photo(p.photos.cover),image:photo(p.photos.cover),images:p.photos.common.map(photo),variantImages:Object.fromEntries(variants.map(v=>[v.name,(p.photos.variants[v.id]||[]).map(photo)]))};}).filter(Boolean);
 return {products,categories:['全部好物',...modernCategories],catalogPreview:{revision:payload.revision,count:products.length,localOnly:true}};
 },media(ref,size){if(!allowed.has(ref))throw new StoreError(404,'照片不在本次顾客预览中');return PhotoLibrary.prototype.media.call({root:dir},ref,size==='thumb'?'thumb':'detail');}};
}
export async function startCustomerPreview({dataDir=defaultDataDir(),port=3200,open=true}={}){
 const localCatalogue=localCatalogueReader(dataDir),initial=localCatalogue.read(),server=createServer({localCatalogue});
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){if(error.code==='EADDRINUSE')throw Error('3200预览端口已使用。请继续用已打开的08窗口，或关闭旧08再重开；未结束其他程序。');throw error;}
 const address=`http://127.0.0.1:${server.address().port}/`;console.log(`本机真实商品顾客预览（原网站）\n入口：${address}\n当前${initial.catalogPreview.count}件在售非演示商品。修改后台资料后刷新顾客页面即可读取。\n只读商品资料和带水印展示图，不修改商品库、不发布、不提供原图。请勿对外转发。\n停止：在本窗口按Ctrl+C。`);if(open&&process.platform==='win32')spawn('explorer.exe',[address],{stdio:'ignore',detached:true}).on('error',()=>{}).unref();return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startCustomerPreview().catch(error=>{console.error(error.status?error.message:'本机预览未能启动，请检查07中的资料及本机端口；没有修改商品库。');process.exitCode=1;});
