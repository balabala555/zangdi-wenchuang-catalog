// Private originals never enter public output. All sizes are derived from a pristine local source.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {products} from '../src/data.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifestFile=path.join(root,'src/generated-images.js');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const settings={thumb:240,card:640,detail:1600};
export const watermarkVersion='zh-tashi-duck-v1';
const mark=await readFile(path.join(root,'assets/watermark-text.png'));
const legacyFiles=JSON.parse(await readFile(path.join(root,'scripts/legacy-public-images.json'),'utf8'));
const recipe=JSON.stringify({legacy:hash(Buffer.from(JSON.stringify(legacyFiles))),settings,watermarkVersion,mark:hash(mark),encoding:'lossless-webp-or-jpeg94-srgb',layout:'3-interior-lines-v2'});
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
 async function marked(width){
  const base=await sharp(original).rotate().resize({width,height:width,fit:'inside',withoutEnlargement:true}).withIccProfile('srgb').png().toBuffer({resolveWithObject:true});
  const w=base.info.width,h=base.info.height;
  const strip=await sharp(mark).resize({width:Math.max(1,Math.round(w*0.53))}).rotate(-18,{background:'#00000000'}).resize({width:Math.floor(w*0.75),height:Math.max(1,Math.floor(h*0.23)),fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
  const overlays=[[0.06,0.27],[0.36,0.49],[0.08,0.74]].map(([x,y])=>({input:strip.data,left:Math.min(Math.round(w*x),w-strip.info.width),top:Math.min(Math.round(h*y),h-strip.info.height)}));
  return sharp(base.data).composite(overlays);
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
  entry[size]={path:relative,width:metadata.width,height:metadata.height,bytes:bytes.length,sha256:digest};
 }
 // Keep the existing public URL as a watermarked compatibility fallback, never the original.
 const extension=path.extname(source).slice(1).toLowerCase();
 let publicImage=await marked(Math.max(meta.width,meta.height));
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
