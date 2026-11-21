import {siteConfig} from '../src/site.js';
import {releaseInfo} from '../src/version.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {CatalogStore,categories,modernCategories,statuses,codeRoot,defaultDataDir,StoreError} from './store.mjs';
import {brandConfig} from '../src/brand.js';
import {optimizedPhotos} from '../src/generated-images.js';
const here=fileURLToPath(new URL('./',import.meta.url));
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const media=new Map(Object.values(optimizedPhotos).flatMap(p=>[p.public,p.thumb,p.card,p.detail]).map(p=>[p.path,p.sha256]));
export function createAdminServer({dataDir=defaultDataDir()}={}){
 const store=new CatalogStore(dataDir),session=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try{
   const port=server.address()?.port,host=req.headers.host,origin='http://'+host;
   if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!['127.0.0.1:'+port,'localhost:'+port].includes(host))return send(403,{error:'管理台仅允许本机访问'});
   if((req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'拒绝其他网站发起的管理请求'});
   const url=new URL(req.url,origin),pathname=url.pathname;
   if(req.method==='GET'&&pathname==='/'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(here,'index.html')));
   }
   if(req.method==='GET'&&['/admin.js','/admin.css'].includes(pathname)){res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});return res.end(fs.readFileSync(path.join(here,pathname.slice(1))));}
   if(req.method==='POST'&&pathname==='/api/open-session'){
    if(req.headers.origin!==origin)return send(403,{error:'请从本机授权入口打开'});
    let bytes=0,chunks=[];for await(const c of req){bytes+=c.length;if(bytes>2048)return send(413,{error:'授权请求过大'});chunks.push(c);}let token;try{token=JSON.parse(Buffer.concat(chunks)).token;}catch{}
    if(!equal(token,session))return send(401,{error:'启动授权无效，请使用07管理窗口显示的完整入口'});
    res.setHeader('Set-Cookie','zangdi_admin='+session+'; HttpOnly; SameSite=Strict; Path=/');return send(200,{ok:true});
   }
   const cookie=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('zangdi_admin='))?.slice(13);
   if(!equal(cookie,session))return send(401,{error:'请从本机管理台首页重新打开，未修改商品资料'});
   if(req.method==='GET'&&pathname==='/media'){let file=url.searchParams.get('path');if(!media.has(file))return send(404,{error:'只能查看已验证的受保护商品照片'});const size=url.searchParams.get('size');if(['thumb','detail'].includes(size)&&optimizedPhotos[file])file=optimizedPhotos[file][size].path;const bytes=fs.readFileSync(path.join(codeRoot,file));if(createHash('sha256').update(bytes).digest('hex')!==media.get(file))return send(409,{error:'图片保护校验失败，未展示未验证图片'});res.writeHead(200,{'Content-Type':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'image/jpeg'});return res.end(bytes);}
   if(req.method==='GET'&&pathname==='/api/session')return send(200,{csrf,siteName:siteConfig.name,brandName:brandConfig.name,version:releaseInfo.version,categories,modernCategories,statuses,dataDir:store.dir,contacts:(Array.isArray(brandConfig.customerServices)?brandConfig.customerServices:[]).map(s=>s?.wechatId).filter(id=>typeof id==='string'&&id.trim()),phase:'第一阶段：本地资料管理；未连接顾客网站'});
   if(req.method==='GET'&&pathname==='/api/catalog')return send(200,{catalog:store.read(),fingerprint:store.fingerprint()});
   if(req.method==='GET'&&pathname==='/api/backups')return send(200,{...store.list(),fingerprint:store.fingerprint()});
   if(req.method==='GET'&&pathname==='/api/backup/download'){const backup=store.download();res.setHeader('Content-Disposition','attachment; filename="catalog-backup-'+Date.now()+'.json"');return send(200,backup);}
   if(req.method!=='POST')return send(404,{error:'没有这个管理入口'});
   if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],csrf))return send(403,{error:'管理确认已失效，请刷新后重试；未修改商品资料'});
   const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>10*1024*1024)throw new StoreError(413,'资料过大，本阶段最多导入10MB商品资料备份');chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks));}catch{throw new StoreError(400,'请求格式不正确');}if(!body||typeof body!=='object'||Array.isArray(body))throw new StoreError(400,'请求格式不正确');
   let result;
   if(pathname==='/api/product/save'){if(!body.product||typeof body.product!=='object'||Array.isArray(body.product))throw new StoreError(400,'商品资料格式不正确');result=store.save(body.product,body.id||null,body.revision);}
   else if(pathname==='/api/backup')result=store.backup(body.revision);
   else if(pathname==='/api/restore')result=store.restore(body);
   else return send(404,{error:'本阶段不提供上传、删除原图或发布接口'});
   return send(200,{catalog:result,fingerprint:store.fingerprint(),message:'已保存到本地商品库；尚未同步顾客网站或正式发布'});
  }catch(error){return send(error.status||500,{error:error.status?error.message:'操作未完成，原快照保留。请保留数据目录并检查磁盘权限或可用空间。',fingerprint:store.fingerprint()});}
 });
 return {server,store,launchToken:session};
}
export async function startAdmin({dataDir=defaultDataDir(),port=3100,open=true}={}){
 const app=createAdminServer({dataDir});
 // One explicit local port avoids silently opening a second management process.
 try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});}
 catch(error){if(error.code==='EADDRINUSE')throw Error('3100管理端口已被占用。若管理台已经打开，请继续使用原窗口；否则关闭原管理窗口后重试。顾客网站3000端口不受影响。');throw error;}
 const address='http://127.0.0.1:'+app.server.address().port+'/#'+app.launchToken;
 console.log(brandConfig.name+' V'+releaseInfo.version+' 本地商品管理·第一阶段\n管理入口：'+address+'\n私有商品库：'+app.store.dir+'\n仅本机访问；此随机授权入口仅本次启动有效，请勿转发。保存不发布。关闭管理台服务请在本窗口按Ctrl+C。');
 if(open&&process.platform==='win32')spawn('explorer.exe',[address],{stdio:'ignore',detached:true}).on('error',()=>{}).unref();return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startAdmin().catch(error=>{console.error(error.message);process.exitCode=1;});
