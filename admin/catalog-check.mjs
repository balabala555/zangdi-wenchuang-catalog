import {originalFile,productImages} from './product-images.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {optimizedPhotos} from '../src/generated-images.js';
import {brandConfig} from '../src/brand.js';
import {assetPattern,assetMeta,assetPath,sha} from './assets.mjs';
import {modernCategories,statuses,StoreError} from './store.mjs';
export const photoRefs=p=>[...new Set([p.photos.cover,...p.photos.common,...Object.values(p.photos.variants).flat()].filter(Boolean))];
export const orderedProducts=products=>products.map((p,i)=>({p,i})).sort((a,b)=>modernCategories.indexOf(a.p.category)-modernCategories.indexOf(b.p.category)||Number(!!b.p.pinned)-Number(!!a.p.pinned)||a.i-b.i).map(x=>x.p);
export function checkCatalogue(store,photos,archives){
 const catalog=store.read(),cache=new Map(),inspect=ref=>{if(cache.has(ref))return cache.get(ref);let result;try{if(assetPattern.test(ref))assetMeta(store.dir,ref,true);originalFile(store.dir,ref);}catch{result={level:'error',text:'私有原图缺失或照片校验失败，无法生成无水印展示图，请从完整备份恢复'};}cache.set(ref,result||null);return result;};
 const results=catalog.products.filter(p=>!p.trashedAt).map(p=>{const issues=[],add=(level,text)=>issues.push({level,text});if(!p.name.trim())add('error','商品名称未填写');if(!modernCategories.includes(p.category))add('warning','请确认七大商品分类，当前为历史分类');if(!Number.isSafeInteger(p.priceCents)||p.priceCents<1)add('error','商品售价无效');if(p.status!=='on_sale')add('warning','当前'+statuses[p.status]+'，未来发布时隐藏');if(p.demo)add('warning','原有演示商品不应当作真实商品发布');if(!photoRefs(p).length)add('warning','缺少商品展示照片');if(!p.photos.cover)add('warning','尚未设置商品封面');
 for(const ref of photoRefs(p)){const problem=inspect(ref);if(problem&&!issues.some(i=>i.text===problem.text))add(problem.level,problem.text);}
 for(const v of p.variants){const active=(v.status||p.status)==='on_sale';if(p.status==='on_sale'&&active&&p.variants.length>1&&!(p.photos.variants[v.id]?.length))add('warning',`款式“${v.name}”缺少明确关联的独立照片`);if(v.priceCents!==undefined&&v.priceCents!==null&&(!Number.isSafeInteger(v.priceCents)||v.priceCents<1))add('error',`款式“${v.name}”售价无效`);}
 if(p.status==='on_sale'&&!p.variants.some(v=>(v.status||p.status)==='on_sale'))add('warning','商品在售但所有款式均未在售');return {id:p.id,name:p.name,status:issues.some(i=>i.level==='error')?'error':issues.length?'needs_work':'ready',issues};});
 return {revision:catalog.revision,results,summary:{ready:results.filter(r=>r.status==='ready').length,needs_work:results.filter(r=>r.status==='needs_work').length,error:results.filter(r=>r.status==='error').length,trash:catalog.products.filter(p=>p.trashedAt).length},notice:'“可以发布”仅代表通过本机检查，不代表已经发布。正式发布仍关闭。'};
}
// Historical endpoint kept compatible: cache generation only, no business-data migration.
export async function upgradeWatermarks(store,photos,archives,{revision,confirm}){
 if(confirm!==true)throw new StoreError(400,'请确认从私有原图生成无水印展示缓存');
 return store.locked(async()=>{const current=store.read();if(current.revision!==revision)throw new StoreError(409,'商品库已更新，请刷新');const refs=[...new Set(current.products.flatMap(photoRefs))];const {job:id}=archives.start(revision);while(archives.jobs.get(id).state==='working')await new Promise(r=>setTimeout(r,100));if(archives.jobs.get(id).state!=='done')throw new StoreError(409,'完整备份失败，未继续处理');let changed=0;for(const ref of refs){await productImages(store.dir,ref);if(assetPattern.test(ref)&&assetMeta(store.dir,ref).recipe.version!=='unwatermarked-product-v1')changed++;}return {catalog:current,changed,backup:id};});
}
