import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {products} from './src/data.js';
import {photoPath} from './src/images.js';
const root=path.dirname(fileURLToPath(import.meta.url));
// Bundle the known local modules into a standalone preview, without eval.
export async function buildPreview(){
  const read=file=>readFile(path.join(root,file),'utf8');
  const [html,css,...modules]=await Promise.all(['index.html','src/style.css','src/data.js','src/cart.js','src/images.js','src/app.js'].map(read));
  const paths=new Set(products.flatMap(p=>[p.image,p.coverImage,...(p.images || []),...Object.values(p.variantImages || {}).flat()]).map(photoPath).filter(Boolean));
  const embeddedPhotos={};
  for(const photo of paths){
    const extension=path.extname(photo).slice(1).toLowerCase();
    const mime=extension==='jpg' || extension==='jpeg'?'image/jpeg':'image/'+extension;
    embeddedPhotos[photo]='data:'+mime+';base64,'+(await readFile(path.join(root,photo))).toString('base64');
  }
  const js='const embeddedPhotos='+JSON.stringify(embeddedPhotos)+';\n'+modules.map(source=>source.replace(/^import .* from '\.\/[^']+';\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
  const output=html.replace(/<a id="download-page"[^>]*>[^<]*<\/a>/,'').replace('<link rel="stylesheet" href="./src/style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./src/app.js"></script>',()=>`<script>\n(()=>{\n${js.replace(/<\/script/gi,'<\\/script')}\n})();\n</script>`);
  await mkdir(path.join(root,'dist'),{recursive:true});
  await writeFile(path.join(root,'dist/index.html'),output);
  return output;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await buildPreview();console.log('Built dist/index.html — standalone preview; open in a browser.');
}
