import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {products} from './src/data.js';
import {homeSources} from './src/homepage.js';
import {homepagePhotos} from './src/generated-homepage-images.js';
import {brandConfig,validateBrand} from './src/brand.js';
import {optimizedPhotos} from './src/generated-images.js';
import {photoPath} from './src/images.js';
const root=path.dirname(fileURLToPath(import.meta.url));
// Bundle the known local modules into a standalone preview, without eval.
export async function buildPreview(){
  validateBrand();
  const read=file=>readFile(path.join(root,file),'utf8');
  const [html,css,...modules]=await Promise.all(['index.html','src/style.css','src/version.js','src/site.js','src/homepage.js','src/data.js','src/cart.js','src/brand.js','src/generated-images.js','src/generated-homepage-images.js','src/images.js','src/export.js','src/app.js'].map(read));
  const paths=new Set([...Object.keys(homeSources),...products.flatMap(p=>[p.image,p.coverImage,...(p.images || []),...Object.values(p.variantImages || {}).flat()])].map(photoPath).filter(Boolean));
  const embeddedPhotos={},missingProductPhotos=[];let embeddedBytes=0;
  const maxEmbeddedBytes=16*1024*1024;
  for(const photo of paths){
    const entry=optimizedPhotos[photo] || homepagePhotos[photo];
    if(!entry || !(entry.watermarkVersion==='merchant-approved-assets-v1.1' || entry.version==='homepage-vi1.1-private-masks-v1'))throw new Error('Missing verified watermarked rendition: '+photo);
    const rendition=entry.detail.path;
    let photoBytes;if(optimizedPhotos[photo]){try{const {productPhoto}=await import('./admin/product-images.mjs');photoBytes=await productPhoto(path.join(root,'.private-originals'),photo,'detail');}catch{embeddedPhotos[photo]=null;missingProductPhotos.push(photo);continue;}}else photoBytes=await readFile(path.join(root,rendition));
    const bytes=photoBytes.length;
    if(embeddedBytes+bytes>maxEmbeddedBytes){if(optimizedPhotos[photo]){embeddedPhotos[photo]=null;missingProductPhotos.push(photo);}continue;}
    embeddedBytes+=bytes;
    const extension=optimizedPhotos[photo]?'webp':path.extname(rendition).slice(1).toLowerCase();
    const mime=extension==='jpg' || extension==='jpeg'?'image/jpeg':'image/'+extension;
    embeddedPhotos[photo]='data:'+mime+';base64,'+photoBytes.toString('base64');
  }
  const qrs={};
  for(const service of brandConfig.customerServices){
    const file=service.qrCodePath;if(!file)continue;
    const mime=path.extname(file).slice(1).toLowerCase().replace('jpg','jpeg');
    qrs[file]='data:image/'+mime+';base64,'+(await readFile(path.join(root,file))).toString('base64');
  }
  const brandAssets={};
  if(brandConfig.assets?.enabled)for(const file of Object.values(brandConfig.assets.files)){const bytes=await readFile(path.join(root,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Brand asset checksum mismatch: '+file.path);brandAssets[file.path]='data:image/png;base64,'+bytes.toString('base64');}
  const js='const embeddedBrandAssets='+JSON.stringify(brandAssets)+';\n'+'const embeddedBrandQrs='+JSON.stringify(qrs)+';\nconst embeddedPhotos='+JSON.stringify(embeddedPhotos)+';\n'+modules.map(source=>source.replace(/^import .* from '\.\/[^']+';\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
  let brandedHtml=missingProductPhotos.length?html.replace('<main>','<main><p class="small-note">此静态预览有部分商品图片未嵌入（原图不可用或容量限制），相关照片未展示。请用07后台核对原图；不会用旧水印照片替代。</p>'):html;for(const [file,url] of Object.entries(brandAssets))brandedHtml=brandedHtml.replaceAll('src="./'+file+'"','src="'+url+'"');
  const output=brandedHtml.replace(/<a id="download-page"[^>]*>[^<]*<\/a>/,'').replace('<link rel="stylesheet" href="./src/style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./src/app.js"></script>',()=>`<script>\n(()=>{\n${js.replace(/<\/script/gi,'<\\/script')}\n})();\n</script>`);
  await mkdir(path.join(root,'dist'),{recursive:true});
  await writeFile(path.join(root,'dist/index.html'),output);
  return output;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await buildPreview();console.log('Built dist/index.html — standalone preview; open in a browser.');
}
