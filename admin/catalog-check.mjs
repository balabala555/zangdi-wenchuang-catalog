import fs from 'node:fs';
import path from 'node:path';
import {optimizedPhotos} from '../src/generated-images.js';
import {brandConfig} from '../src/brand.js';
import {assetPattern,assetMeta,assetPath,sha} from './assets.mjs';
import {modernCategories,statuses,StoreError} from './store.mjs';
export const photoRefs=p=>[...new Set([p.photos.cover,...p.photos.common,...Object.values(p.photos.variants).flat()].filter(Boolean))];
export const orderedProducts=products=>products.map((p,i)=>({p,i})).sort((a,b)=>modernCategories.indexOf(a.p.category)-modernCategories.indexOf(b.p.category)||Number(!!b.p.pinned)-Number(!!a.p.pinned)||a.i-b.i).map(x=>x.p);
export function checkCatalogue(store,photos,archives){
 const catalog=store.read(),cache=new Map(),inspect=ref=>{if(cache.has(ref))return cache.get(ref);let result;try{if(assetPattern.test(ref)){const m=assetMeta(store.dir,ref,true);if(m.recipe.version!=='distributed-brand-v1')result={level:'warning',text:'旧照片仅有右下角水印，请从私有原图升级分布式水印'};else if(JSON.stringify(m.recipe.contacts)!==JSON.stringify(brandConfig.customerServices.map(c=>c.wechatId)))result={level:'warning',text:'照片客服信息与当前配置不一致，请核对原图后更新保护图'};}else{const p=optimizedPhotos[ref];if(!p)throw Error();for(const item of [p.public,p.thumb,p.card,p.detail])if(sha(fs.readFileSync(archives.legacyFile(item.path)))!==item.sha256)throw Error();}}catch{result={level:'error',text:'照片文件缺失、损坏或保护记录不完整，请从完整备份恢复'};}cache.set(ref,result||null);return result;};
 const results=catalog.products.filter(p=>!p.trashedAt).map(p=>{const issues=[],add=(level,text)=>issues.push({level,text});if(!p.name.trim())add('error','商品名称未填写');if(!modernCategories.includes(p.category))add('warning','请确认七大商品分类，当前为历史分类');if(!Number.isSafeInteger(p.priceCents)||p.priceCents<1)add('error','商品售价无效');if(p.status!=='on_sale')add('warning','当前'+statuses[p.status]+'，未来发布时隐藏');if(p.demo)add('warning','原有演示商品不应当作真实商品发布');if(!photoRefs(p).length)add('warning','缺少商品展示照片');if(!p.photos.cover)add('warning','尚未设置商品封面');
 for(const ref of photoRefs(p)){const problem=inspect(ref);if(problem&&!issues.some(i=>i.text===problem.text))add(problem.level,problem.text);}
 for(const v of p.variants){const active=(v.status||p.status)==='on_sale';if(p.status==='on_sale'&&active&&p.variants.length>1&&!(p.photos.variants[v.id]?.length))add('warning',`款式“${v.name}”缺少明确关联的独立照片`);if(v.priceCents!==undefined&&v.priceCents!==null&&(!Number.isSafeInteger(v.priceCents)||v.priceCents<1))add('error',`款式“${v.name}”售价无效`);}
 if(p.status==='on_sale'&&!p.variants.some(v=>(v.status||p.status)==='on_sale'))add('warning','商品在售但所有款式均未在售');return {id:p.id,name:p.name,status:issues.some(i=>i.level==='error')?'error':issues.length?'needs_work':'ready',issues};});
 return {revision:catalog.revision,results,summary:{ready:results.filter(r=>r.status==='ready').length,needs_work:results.filter(r=>r.status==='needs_work').length,error:results.filter(r=>r.status==='error').length,trash:catalog.products.filter(p=>p.trashedAt).length},notice:'“可以发布”仅代表通过本机检查，不代表已经发布。正式发布仍关闭。'};
}
export async function upgradeWatermarks(store,photos,archives,{revision,confirm}){
 if(confirm!==true)throw new StoreError(400,'请先确认备份并升级旧照片水印');
 return store.locked(async()=>{const current=store.read();if(current.revision!==revision)throw new StoreError(409,'商品库已更新，请刷新后重试');const oldRefs=[...new Set(current.products.flatMap(photoRefs))].filter(ref=>assetPattern.test(ref)&&assetMeta(store.dir,ref,true).recipe.version==='corner-brand-v1');if(!oldRefs.length)return {catalog:current,changed:0};
 store.ensure141Baseline();const {job:id}=archives.start(revision);while(archives.jobs.get(id).state==='working')await new Promise(r=>setTimeout(r,100));if(archives.jobs.get(id).state!=='done')throw new StoreError(409,'升级前完整备份未完成，未改动照片关联');const map=new Map();for(const ref of oldRefs){const m=assetMeta(store.dir,ref,true),file=path.join(assetPath(store.dir,ref),m.original),next=await photos.upload(file,m.originalName);map.set(ref,next.ref);}
 const next=structuredClone(current),replace=ref=>map.get(ref)||ref;for(const p of next.products){p.photos.cover=replace(p.photos.cover);p.photos.common=p.photos.common.map(replace);if(p.photos.order)p.photos.order=[...new Set(p.photos.order.map(replace))];for(const key of Object.keys(p.photos.variants))p.photos.variants[key]=p.photos.variants[key].map(replace);}
 const catalog=store.commit(next,'完整备份后从原图升级分布式品牌水印，旧文件保留');return {catalog,changed:map.size,backup:id};});
}
