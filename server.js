import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homepagePhotos} from './src/generated-homepage-images.js';
import {optimizedPhotos} from './src/generated-images.js';
import {buildPreview} from './build.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
export function createServer({basePath='/',management=null}={}){
  const base='/'+basePath.split('/').filter(Boolean).join('/');
  const prefix=base==='/'?'':base;
  const immutablePhotos=new Set([...Object.values(optimizedPhotos),...Object.values(homepagePhotos)].flatMap(entry=>['thumb','card','detail'].map(size=>'/'+entry[size].path)));
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      let pathname=decodeURIComponent(url.pathname);
      if(pathname==='/.catalog-control'||pathname==='/.catalog-control/stop'){
        const actual=Buffer.from(String(req.headers['x-catalog-token']||'')),expected=Buffer.from(management?.token||'');
        const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        if(!management||!loopback||req.headers.origin||actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.writeHead(404);return res.end('Not found');}
        res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
        if(pathname.endsWith('/stop')&&req.method==='POST'){res.end(JSON.stringify({stopping:true}),()=>{server.close();server.closeAllConnections();});return;}
        if(pathname==='/.catalog-control'&&req.method==='GET')return res.end(JSON.stringify({root,version:management.version,pid:process.pid}));
        res.writeHead(405);return res.end();
      }

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
      if(pathname.startsWith('/public/images/') || pathname.startsWith('/public/branding/')){
        const etag='"'+createHash('sha256').update(body).digest('hex')+'"';
        headers.ETag=etag;
        headers['Cache-Control']=immutablePhotos.has(pathname)?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate';
        if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
      }
      res.writeHead(200,headers);
      res.end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3000),basePath=process.env.BASE_PATH||'/';
  createServer({basePath,management:process.env.CATALOG_PREVIEW_TOKEN?{token:process.env.CATALOG_PREVIEW_TOKEN,version:process.env.CATALOG_PREVIEW_VERSION}:null}).listen(port,'0.0.0.0',()=>console.log(`Catalog running on port ${port}, base path ${basePath}`));
}
