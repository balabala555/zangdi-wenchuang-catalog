// Local-only, privacy-aware homepage processing. Never publish private photo bytes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {redactHero,rectifyHero,heroCrop} from './hero-refinement.mjs';
import {homeSources} from '../src/homepage.js';
import {brandConfig} from '../src/brand.js';
import {approvedAsset,watermarkSvg,brandMarkSvg,adaptiveInk,visualInk} from './watermark-renderer.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const sizes={thumb:240,card:640,detail:1600},version='homepage-vi1.1-private-masks-v1';
for(const key of Object.keys(brandConfig.assets.files))await approvedAsset(key);
const recipe=JSON.stringify({version,sizes,brand:brandConfig,processing:hash(await readFile(fileURLToPath(import.meta.url))),renderer:hash(await readFile(new URL('./watermark-renderer.mjs',import.meta.url)))});
let previous={};try{previous=JSON.parse((await readFile(new URL('../src/generated-homepage-images.js',import.meta.url),'utf8')).split('export const homepagePhotos = ')[1].trim().replace(/;$/,''));}catch{}
await mkdir(new URL('../public/images/homepage/',import.meta.url),{recursive:true});await mkdir(new URL('../public/images/optimized/',import.meta.url),{recursive:true});
const output={};let reused=0,sharp;
for(const [source,policy] of Object.entries(homeSources)){
 const old=previous[source];let original;try{original=await readFile(path.join(process.env.CATALOG_ORIGINALS_DIR||path.join(root,'.private-originals'),source.slice('public/images/'.length)));}catch{}
 const refinementHash=policy.refinement?hash(await readFile(new URL('./hero-refinement.mjs',import.meta.url))):'';
 const signature=recipe+refinementHash+JSON.stringify(policy);
 let valid=old?.recipe===signature && (!original || hash(original)===old.sourceSha256);
 if(valid)for(const p of [old.public,...Object.keys(sizes).map(k=>old[k])]){try{if(hash(await readFile(path.join(root,p.path)))!==p.sha256)valid=false;}catch{valid=false;}}
 if(valid){output[source]=old;reused++;continue;}
 if(!original)throw Error('Missing private homepage original: '+source);
 if(!sharp){try{sharp=(await import('sharp')).default;}catch{throw Error('首页图片处理模块未就绪，请运行 npm ci --include=optional；支持官方WASM备用，不能用无水印原图替代。');}}
 const base=await sharp(original).rotate().withIccProfile('srgb').png().toBuffer({resolveWithObject:true}),w=base.info.width,h=base.info.height;
 const masks=policy.masks.map(([x,y,bw,bh])=>({left:Math.floor(x*w),top:Math.floor(y*h),width:Math.min(w-Math.floor(x*w),Math.ceil(bw*w)),height:Math.min(h-Math.floor(y*h),Math.ceil(bh*h))}));
 // Opaque panels cannot be undone from public output; original remains unchanged locally.
 const masked=policy.refinement?await redactHero(sharp,base.data,masks,policy.refinement.feather):await sharp(base.data).composite(await Promise.all(masks.map(async m=>({input:await sharp({create:{width:m.width,height:m.height,channels:3,background:'#c8bca6'}}).png().toBuffer(),left:m.left,top:m.top})))).png().toBuffer();
 let photo=sharp(masked);if(policy.crop){const [x,y,bw,bh]=policy.crop;photo=photo.extract({left:Math.floor(x*w),top:Math.floor(y*h),width:Math.floor(bw*w),height:Math.floor(bh*h)});}
 const cropped=policy.refinement?await rectifyHero(sharp,await photo.png().toBuffer(),policy.refinement):await photo.png().toBuffer(),entry={version,recipe:signature,sourceSha256:hash(original),originalBytes:original.length,privacyMasks:masks,crop:policy.crop,...(policy.refinement?{refinement:policy.refinement,privacyMethod:'irreversible-2x2-feathered-v1'}:{}),layers:['brand-mark','distributed-protection']};
 async function marked(max,size='detail'){
  let input=sharp(cropped);if(policy.refinement)input=input.extract(heroCrop(policy.refinement.width,policy.refinement.height,policy.refinement,size));
  const b=await input.resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true}),bw=b.info.width,bh=b.info.height,overlays=[];
  const stats=await sharp(b.data).stats(),luma=(stats.channels[0].mean*.2126+stats.channels[1].mean*.7152+stats.channels[2].mean*.0722)/255;
  const logo=await sharp(await brandMarkSvg(bw*.20,visualInk(luma))).png().toBuffer({resolveWithObject:true});overlays.push({input:logo.data,left:Math.round(bw*.025),top:Math.round(bh*.025)});
  for(const [i,[x,y]]of brandConfig.imageWatermark.positions.entries()){
   const stamp=await sharp(await watermarkSvg(bw,adaptiveInk(luma),brandConfig,i)).rotate(brandConfig.imageWatermark.angle,{background:'#00000000'}).resize({width:Math.max(1,Math.floor(bw*.19)),height:Math.max(1,Math.floor(bh*.17)),fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
   overlays.push({input:stamp.data,left:Math.min(Math.round(bw*x),bw-stamp.info.width),top:Math.min(Math.round(bh*y),bh-stamp.info.height)});
  }
  return sharp(b.data).composite(overlays);
 }
 for(const [size,max]of Object.entries(sizes)){
  const bytes=await (await marked(max,size)).webp({quality:86,effort:4}).toBuffer(),digest=hash(bytes),file=`public/images/optimized/${digest.slice(0,24)}-home-${size}.webp`;await writeFile(path.join(root,file),bytes);const m=await sharp(bytes).metadata();entry[size]={path:file,width:m.width,height:m.height,bytes:bytes.length,sha256:digest};
 }
 const bytes=await (await marked(sizes.detail)).jpeg({quality:90,chromaSubsampling:'4:4:4'}).toBuffer();await writeFile(path.join(root,source),bytes);entry.public={path:source,bytes:bytes.length,sha256:hash(bytes)};output[source]=entry;
}
await writeFile(new URL('../src/generated-homepage-images.js',import.meta.url),'// Public protected derivatives only; originals are private.\nexport const homepagePhotos = '+JSON.stringify(output,null,2)+';\n');
console.log(`Homepage: ${Object.keys(output).length} protected photos, ${reused} unchanged entries reused; privacy masks applied before resize and watermark.`);
