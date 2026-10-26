import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPreview} from './build.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
export function createServer({basePath='/'}={}){
  const base='/'+basePath.split('/').filter(Boolean).join('/');
  const prefix=base==='/'?'':base;
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      let pathname=decodeURIComponent(url.pathname);
      if(prefix && pathname===prefix){res.writeHead(308,{Location:prefix+'/'+url.search});return res.end();}
      if(prefix){if(!pathname.startsWith(prefix+'/')){res.writeHead(404);return res.end('Not found');}pathname=pathname.slice(prefix.length);}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
      if(pathname==='/')pathname='/index.html';
      const allowed=pathname==='/index.html'||pathname==='/preview.html'||pathname==='/download.html'||pathname.startsWith('/src/')||pathname.startsWith('/public/');
      const file=path.resolve(root,'.'+pathname);
      if(!allowed||!file.startsWith(root+path.sep)||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);return res.end('Not found');}
      const standalone=pathname==='/preview.html'||pathname==='/download.html';
      let body=standalone?await buildPreview():await readFile(file);
      // Keep a download entry in the HTTP preview; exported HTML stays self-contained.
      if(pathname==='/preview.html')body=body.replace('</footer>','<a id="download-page" href="./download.html" download="zangdi-catalog.html">下载离线网页 ↓</a></footer>');
      const headers={'Content-Type':types[path.extname(pathname)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
      if(pathname==='/download.html')headers['Content-Disposition']='attachment; filename="zangdi-catalog.html"';
      res.writeHead(200,headers);
      res.end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3000),basePath=process.env.BASE_PATH||'/';
  createServer({basePath}).listen(port,'0.0.0.0',()=>console.log(`Catalog running on port ${port}, base path ${basePath}`));
}
