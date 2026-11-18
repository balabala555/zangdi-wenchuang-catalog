// Private originals never enter public output. All sizes are derived from a pristine local source.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {products} from '../src/data.js';
import {brandConfig,validateBrand} from '../src/brand.js';
import {watermarkSvg,adaptiveInk,visualInk,brandMarkSvg,signatureSvg,approvedAsset} from './watermark-renderer.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifestFile=path.join(root,'src/generated-images.js');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const settings={thumb:240,card:640,detail:1600};
export const watermarkVersion='merchant-approved-assets-v1.1';
validateBrand();
if(brandConfig.assets?.enabled)for(const key of Object.keys(brandConfig.assets.files))await approvedAsset(key);
const fontHash=hash(Buffer.concat(await Promise.all([brandConfig.imageWatermark.fontAssetPath,brandConfig.brandVisual.fontAssetPath].map(file=>readFile(path.join(root,file))))));
const rendererHash=hash(await readFile(path.join(root,'scripts/watermark-renderer.mjs')));
const pipelineHash=hash(await readFile(fileURLToPath(import.meta.url)));
const legacyFiles=JSON.parse(await readFile(path.join(root,'scripts/legacy-public-images.json'),'utf8'));
const qrHashes=await Promise.all(brandConfig.customerServices.map(async service=>({id:service.wechatId,path:service.qrCodePath,hash:service.qrCodePath?hash(await readFile(path.join(root,service.qrCodePath))):null})));
const recipe=JSON.stringify({legacy:hash(Buffer.from(JSON.stringify(legacyFiles))),settings,watermarkVersion,qrHashes,fontHash,rendererHash,pipelineHash,brand:{name:brandConfig.name,englishName:brandConfig.englishName,subtitle:brandConfig.subtitle,visual:brandConfig.brandVisual,assets:brandConfig.assets,contacts:brandConfig.customerServices.map(service=>service.wechatId),watermark:brandConfig.imageWatermark},encoding:'lossless-webp-or-jpeg94-srgb',layout:'three-layers-authentic-qr-footer-v5'});
const sources=[...new Set(products.flatMap(p=>[p.image,p.coverImage,...(p.images || []),...Object.values(p.variantImages || {}).flat()]).filter(Boolean))].sort();
let previous={};
try{previous=JSON.parse((await readFile(manifestFile,'utf8')).split('export const optimizedPhotos = ')[1].trim().replace(/;$/,''));}catch{}
await mkdir(path.join(root,'public/images/optimized'),{recursive:true});
const manifest={};let reused=0,sharp;
async function verified(entry){
 if(!entry || entry.watermarkVersion!==watermarkVersion || entry.recipe!==recipe)return false;
 for(const file of [entry.public,...Object.keys(settings).map(size=>entry[size]),...(entry.legacy || [])]){
  if(!file?.path || !file.sha256)return false;
  try{if(hash(await readFile(path.join(root,file.path)))!==file.sha256)return false;}catch{return false;}
 }
 return true;
}
for(const source of sources){
 if(!/^public\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(source) || source.includes('..'))throw new Error('Invalid photo: '+source);
 const old=previous[source];
 const privateFile=path.join(process.env.CATALOG_ORIGINALS_DIR || path.join(root,'.private-originals'),source.slice('public/images/'.length));
 let original;
 try{original=await readFile(privateFile);}catch{}
 if(await verified(old) && (!original || old.sourceSha256===hash(original))){manifest[source]=old;reused++;continue;}
 if(!original)throw new Error(`Missing private original for ${source}. Place the original in .private-originals/${source.slice('public/images/'.length)}. Never process a published/watermarked copy.`);
 if(!sharp){
  try{sharp=(await import('sharp')).default;}
  catch{throw new Error('图片处理模块未就绪。请使用 Node.js LTS，在项目目录运行 npm ci --include=optional。已发布图片可正常预览；新增图片处理需要 sharp 或官方 WASM 备用模块。');}
 }
 const entry={watermarkVersion,recipe,sourceSha256:hash(original),originalBytes:original.length};
 const meta=await sharp(original).rotate().metadata();
 const rendered=new Map();
 async function marked(width){
  if(rendered.has(width))return sharp(rendered.get(width).png);
  const rotated=meta.orientation>=5 && meta.orientation<=8;
  const aspect=(rotated?meta.height:meta.width)/(rotated?meta.width:meta.height);
  const footerRatio=Math.max(brandConfig.brandVisual.footer.heightRatio,aspect*brandConfig.brandVisual.footer.minHeightWidthRatio);
  const bodyLimit=Math.max(1,Math.floor(width/(1+footerRatio)));
  const base=await sharp(original).rotate().resize({width,height:bodyLimit,fit:'inside',withoutEnlargement:true}).withIccProfile('srgb').png().toBuffer({resolveWithObject:true});
  const w=base.info.width,h=base.info.height,overlays=[];
  async function brightness(left,top,boxW,boxH){
    const regionWidth=Math.max(1,Math.min(Math.ceil(boxW),w-left)),regionHeight=Math.max(1,Math.min(Math.ceil(boxH),h-top));
    const sample=await sharp(base.data).extract({left,top,width:regionWidth,height:regionHeight}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let sum=0;
    for(let i=0;i<sample.data.length;i+=sample.info.channels)sum+=sample.data[i]*0.2126+sample.data[i+1]*0.7152+sample.data[i+2]*0.0722;
    return sum/(sample.info.width*sample.info.height*255);
  }
  const mark=brandConfig.brandVisual.mark,markW=Math.max(1,Math.round(Math.min(w*mark.widthRatio,h*mark.maxHeightRatio/0.60)));
  const markLeft=Math.round(w*mark.leftRatio),markTop=Math.round(h*mark.topRatio);
  const markInk=visualInk(await brightness(markLeft,markTop,markW,markW*0.60));
  const logo=await sharp(await brandMarkSvg(markW,markInk)).png().toBuffer({resolveWithObject:true});
  overlays.push({input:logo.data,left:Math.min(markLeft,w-logo.info.width),top:Math.min(markTop,h-logo.info.height)});
  const protection=brandConfig.imageWatermark;
  for(const [index,[x,y]] of protection.positions.entries()){
    const left=Math.round(w*x),top=Math.round(h*y);
    const ink=adaptiveInk(await brightness(left,top,w*protection.maxWidthRatio,h*protection.maxHeightRatio));
    const source=await watermarkSvg(w,ink,brandConfig,index);
    const stamp=await sharp(source).rotate(protection.angle,{background:'#00000000'}).resize({width:Math.max(1,Math.floor(w*protection.maxWidthRatio)),height:Math.max(1,Math.floor(h*protection.maxHeightRatio)),fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
    overlays.push({input:stamp.data,left:Math.max(0,Math.min(left,w-stamp.info.width-Math.round(w*0.018))),top:Math.min(top,h-stamp.info.height)});
  }
  const photo=await sharp(base.data).composite(overlays).png().toBuffer();
  const footerHeight=Math.max(1,Math.round(Math.max(h*brandConfig.brandVisual.footer.heightRatio,w*brandConfig.brandVisual.footer.minHeightWidthRatio)));
  const footer=await sharp(await signatureSvg(w,footerHeight)).png().toBuffer();
  const png=await sharp(photo).extend({bottom:footerHeight,background:brandConfig.brandVisual.footer.background}).composite([{input:footer,left:0,top:h}]).png().toBuffer();
  rendered.set(width,{png,photoWidth:w,photoHeight:h,footerHeight,resizeWidth:width,resizeHeight:bodyLimit});
  return sharp(png);
 }
 for(const [size,width] of Object.entries(settings)){
  const composed=await marked(width);
  let bytes=await composed.clone().webp({lossless:true,effort:4}).toBuffer(),extension='webp';
  if(size==='detail'){
   const jpeg=await composed.clone().jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();
   if(jpeg.length<bytes.length){bytes=jpeg;extension='jpg';}
  }
  const digest=hash(bytes),relative=`public/images/optimized/${digest.slice(0,24)}-${size}.${extension}`;
  await writeFile(path.join(root,relative),bytes);
  const metadata=await sharp(bytes).metadata();
  const composition=rendered.get(width);
  entry[size]={path:relative,width:metadata.width,height:metadata.height,photoWidth:composition.photoWidth,photoHeight:composition.photoHeight,footerHeight:composition.footerHeight,resizeWidth:composition.resizeWidth,resizeHeight:composition.resizeHeight,layers:['brand-mark','distributed-protection','brand-signature'],bytes:bytes.length,sha256:digest};
 }
 // Keep the existing public URL as a watermarked compatibility fallback, never the original.
 const extension=path.extname(source).slice(1).toLowerCase();
 let publicImage=await marked(settings.detail);
 publicImage=extension==='jpg' || extension==='jpeg'?publicImage.jpeg({quality:94,chromaSubsampling:'4:4:4'}):extension==='png'?publicImage.png():publicImage.webp({lossless:true});
 const publicBytes=await publicImage.toBuffer();
 await writeFile(path.join(root,source),publicBytes);
 entry.public={path:source,bytes:publicBytes.length,sha256:hash(publicBytes)};
 // Do not delete previously tracked files. Replace their bytes with corresponding marked versions.
 const oldFiles=new Map((legacyFiles[source] || []).map(file=>[file.path,file.size]));
 entry.legacy=[];
 for(const [file,size] of oldFiles){
  const extension=path.extname(file).toLowerCase();
  let bytes;
  if(extension==='.webp')bytes=await readFile(path.join(root,entry[size].path));
  else{
   let image=await marked(settings[size]);
   bytes=extension==='.png'?await image.png().toBuffer():await image.jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();
  }
  await writeFile(path.join(root,file),bytes);
  entry.legacy.push({path:file,size,bytes:bytes.length,sha256:hash(bytes)});
 }
 manifest[source]=entry;
}
await writeFile(manifestFile,'// Generated public watermarked renditions only. Private originals are ignored by Git.\nexport const optimizedPhotos = '+JSON.stringify(manifest,null,2)+';\n');
console.log(`Photos: ${sources.length} sources, ${reused} unchanged entries reused; all public renditions watermarked (${watermarkVersion}).`);
