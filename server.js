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
export function createServer({basePath='/',management=null,localCatalogue=null}={}){
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
      if(localCatalogue){
        const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress),port=server.address()?.port;
        if(!loopback||!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)){res.writeHead(403);return res.end('Local preview only');}
        res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
        if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Read-only preview');}
        if(pathname==='/preview.html'||pathname==='/download.html'){res.writeHead(409,{'Content-Type':'text/plain; charset=utf-8'});return res.end('本机商品预览不导出离线网站；请返回首页，生成图片选购清单。');}
        if(pathname==='/src/data.js'){
          try{const snapshot=localCatalogue.read();res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end('const snapshot=JSON.parse('+JSON.stringify(JSON.stringify(snapshot))+');export const products=snapshot.products,categories=snapshot.categories,catalogPreview=snapshot.catalogPreview;');}
          catch{res.writeHead(409,{'Content-Type':'text/javascript; charset=utf-8'});return res.end('throw new Error("本机商品库校验失败，请先用07核对资料；没有改动数据。");');}
        }
        const match=pathname.match(/^\/public\/images\/local-preview\/([a-f0-9]{64})\.webp$/);
        if(match){try{if(url.searchParams.get('size')==='original-file'){res.writeHead(403);return res.end();}const bytes=localCatalogue.media('asset:'+match[1],url.searchParams.get('size'));res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);return res.end('Protected photo unavailable');}}
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
      if(pathname==='/')pathname='/index.html';
      if(localCatalogue&&pathname==='/index.html'){try{localCatalogue.read();}catch{res.writeHead(409,{'Content-Type':'text/plain; charset=utf-8'});return res.end('本机商品资料或照片登记暂不可读，请先在07后台检查；没有新建或修改商品库。');}}
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
