import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
// Bundle the three known local modules into a standalone preview, without eval.
export async function buildPreview(){
  const read=file=>readFile(path.join(root,file),'utf8');
  const [html,css,...modules]=await Promise.all(['index.html','src/style.css','src/data.js','src/cart.js','src/app.js'].map(read));
  const js=modules.map(source=>source.replace(/^import .* from '\.\/[^']+';\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
  const output=html.replace(/<a id="download-page"[^>]*>[^<]*<\/a>/,'').replace('<link rel="stylesheet" href="./src/style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./src/app.js"></script>',()=>`<script>\n(()=>{\n${js.replace(/<\/script/gi,'<\\/script')}\n})();\n</script>`);
  await mkdir(path.join(root,'dist'),{recursive:true});
  await writeFile(path.join(root,'dist/index.html'),output);
  return output;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await buildPreview();console.log('Built dist/index.html — standalone preview; open in a browser.');
}
