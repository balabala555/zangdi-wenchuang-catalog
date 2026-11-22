import {productPhoto} from './product-images.mjs';
import {OnlinePublisher} from './online.mjs';
import {checkCatalogue,upgradeWatermarks} from './catalog-check.mjs';
import {realAcceptance} from './real-acceptance.mjs';
import {Publication} from './publication.mjs';
import {recordFailure} from './diagnostics.mjs';
import {PhotoLibrary,assetPattern} from './assets.mjs';
import {ArchiveService} from './archive.mjs';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {unpack} from './store.mjs';
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
 const store=new CatalogStore(dataDir),photos=new PhotoLibrary(store.dir),archives=new ArchiveService(store,photos),publication=new Publication(store,photos,archives),online=new OnlinePublisher(store),session=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  let operation='request';try{
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
   if(req.method==='GET'&&pathname==='/media'){let file=url.searchParams.get('path');if(assetPattern.test(file||'')){if(url.searchParams.get('size')==='original')return send(403,{error:'原图仅私有保存，可通过完整备份导出，不提供展示访问'});const bytes=await photos.media(file,url.searchParams.get('size'));res.writeHead(200,{'Content-Type':'image/webp'});return res.end(bytes);}if(Object.hasOwn(optimizedPhotos,file)){const bytes=await productPhoto(store.dir,file,url.searchParams.get('size'));res.writeHead(200,{'Content-Type':'image/webp'});return res.end(bytes);}for(const [source,entry]of Object.entries(optimizedPhotos))for(const size of ['public','thumb','card','detail'])if(entry[size]?.path===file){const bytes=await productPhoto(store.dir,source,size==='thumb'?'thumb':'detail');res.writeHead(200,{'Content-Type':'image/webp'});return res.end(bytes);}if(!media.has(file))return send(404,{error:'只能查看已验证的受保护商品照片'});const size=url.searchParams.get('size');if(['thumb','detail'].includes(size)&&optimizedPhotos[file])file=optimizedPhotos[file][size].path;const bytes=fs.readFileSync(archives.legacyFile(file));if(createHash('sha256').update(bytes).digest('hex')!==media.get(file))return send(409,{error:'图片保护校验失败，未展示未验证图片'});res.writeHead(200,{'Content-Type':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'image/jpeg'});return res.end(bytes);}
   if(req.method==='GET'&&pathname==='/api/session')return send(200,{csrf,siteName:siteConfig.name,brandName:brandConfig.name,version:releaseInfo.version,adminPatch:releaseInfo.adminPatch,revision:releaseInfo.revision,categories,modernCategories,statuses,dataDir:store.dir,contacts:(Array.isArray(brandConfig.customerServices)?brandConfig.customerServices:[]).map(s=>s?.wechatId).filter(id=>typeof id==='string'&&id.trim()),phase:'V1.6本地发布及受保护线上发布；保存草稿不联网',lastCategory:(()=>{try{return store.read().preferences?.lastCategory;}catch{return null;}})()});
   if(req.method==='GET'&&pathname==='/api/catalog')return send(200,{catalog:store.read(),fingerprint:store.fingerprint()});
   if(req.method==='GET'&&pathname==='/api/online/status')return send(200,online.status());
   if(req.method==='GET'&&pathname==='/api/publication')return send(200,publication.status());
   if(req.method==='GET'&&pathname==='/api/preflight')return send(200,checkCatalogue(store,photos,archives));
   if(req.method==='GET'&&pathname==='/api/backups')return send(200,{...store.list(),fingerprint:store.fingerprint()});
   if(req.method==='GET'&&pathname==='/api/backup/download'){const backup=store.download();res.setHeader('Content-Disposition','attachment; filename="catalog-backup-'+Date.now()+'.json"');return send(200,backup);}
   if(req.method==='GET'&&pathname==='/api/backup/full/list')return send(200,{files:fs.readdirSync(path.join(store.dir,'backups')).filter(f=>/^[a-f0-9-]{36}\.zip$/.test(f)).map(f=>({id:f.slice(0,-4),bytes:fs.statSync(path.join(store.dir,'backups',f)).size,time:fs.statSync(path.join(store.dir,'backups',f)).mtime.toISOString()})).sort((a,b)=>b.time.localeCompare(a.time))});
   if(req.method==='GET'&&pathname==='/api/photos')return send(200,{assets:photos.list().map(m=>({ref:m.id,name:m.originalName})),coverage:archives.coverage()});
   if(req.method==='GET'&&pathname.startsWith('/api/backup/jobs/')){const job=archives.jobs.get(pathname.split('/').pop());return job?send(200,job):send(404,{error:'备份任务不存在'});}
   if(req.method==='GET'&&pathname.startsWith('/api/backup/full/download/')){const id=pathname.split('/').pop(),job=archives.jobs.get(id);if(!/^[a-f0-9-]{36}$/.test(id)||!fs.existsSync(path.join(store.dir,'backups',id+'.zip')))return send(404,{error:'备份尚未生成成功'});res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="zangdi-full-backup-'+(job?.revision||'saved')+'.zip"'});return fs.createReadStream(path.join(store.dir,'backups',id+'.zip')).pipe(res);}
   if(req.method==='GET'&&pathname==='/api/backup/baseline141'){const file=path.join(store.dir,'upgrade-1.4.1','catalog-before.json');if(!fs.existsSync(file))return send(404,{error:'尚未产生V1.4.1升级前资料基线；首次更改前自动生成'});res.setHeader('Content-Disposition','attachment; filename="catalog-before-1.4.1.json"');res.writeHead(200,{'Content-Type':'application/json'});return res.end(fs.readFileSync(file));}
   if(req.method==='GET'&&pathname==='/api/backup/phase1'){const file=path.join(store.dir,'phase2-upgrade','catalog-before.json');if(!fs.existsSync(file))return send(404,{error:'尚未产生升级前基线'});res.setHeader('Content-Disposition','attachment; filename="catalog-before-phase2.json"');res.writeHead(200,{'Content-Type':'application/json'});return res.end(fs.readFileSync(file));}
   if(req.method!=='POST')return send(404,{error:'没有这个管理入口'});
   if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],csrf))return send(403,{error:'管理确认已失效，请刷新后重试；未修改商品资料'});
   if(pathname==='/api/photo/upload'||pathname==='/api/backup/full/check'){
    if(pathname==='/api/photo/upload'){operation='photo-baseline';store.prepare141();store.preparePhase2();operation='photo-receive';}const temp=path.join(store.dir,'incoming',randomUUID()+'.upload'),limit=pathname==='/api/photo/upload'?25*1024**2:8*1024**3;let size=0;
    try{await pipeline(req,new Transform({transform(chunk,_,next){size+=chunk.length;if(size>limit)return next(new StoreError(413,'文件超过允许大小'));next(null,chunk);}}),fs.createWriteStream(temp,{flags:'wx',mode:0o600}));
     if(pathname==='/api/photo/upload'){const result=await photos.upload(temp,decodeURIComponent(String(req.headers['x-file-name']||'照片')));return send(200,{ref:result.ref,name:result.meta.originalName,reused:result.reused});}
     return send(200,await archives.check(temp));
    }finally{try{if(fs.existsSync(temp))fs.unlinkSync(temp);}catch(cleanupError){recordFailure(store.dir,cleanupError,'photo-cleanup');}}
   }
   const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>10*1024*1024)throw new StoreError(413,'资料过大，本阶段最多导入10MB商品资料备份');chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks));}catch{throw new StoreError(400,'请求格式不正确');}if(!body||typeof body!=='object'||Array.isArray(body))throw new StoreError(400,'请求格式不正确');
   let result;
   if(pathname==='/api/online/configure')return send(200,await online.configure(body));
   if(pathname==='/api/online/credentials')return send(200,await online.testCredentials());
   if(pathname==='/api/online/prepare')return send(200,await online.prepare());
   if(pathname==='/api/online/preview')return send(200,await online.preview());
   if(pathname==='/api/online/deploy')return send(200,await online.deploy(body));
   if(pathname==='/api/online/rollback')return send(200,await online.rollback(body));
   if(pathname==='/api/product/save'){operation='product-validate';if(!body.product||typeof body.product!=='object'||Array.isArray(body.product))throw new StoreError(400,'商品资料格式不正确');store.preparePhase2();if(body.product.photos){const p=body.product.photos;photos.validateRefs([p.cover,...(p.common||[]),...Object.values(p.variants||{}).flat()].filter(Boolean));}operation='product-snapshot';result=store.save(body.product,body.id||null,body.revision);}
   else if(pathname==='/api/publication/verify-real'){return send(200,await realAcceptance(store));}
   else if(pathname==='/api/publication/initialize'){result=await publication.initialize(body);}
   else if(pathname==='/api/publication/publish'){result=publication.publish(body);}
   else if(pathname==='/api/publication/withdraw'){result=publication.publish({...body,withdraw:true});}
   else if(pathname==='/api/product/action'){result=store.action(body);}
   else if(pathname==='/api/photos/upgrade'){const value=await upgradeWatermarks(store,photos,archives,body);return send(200,{...value,fingerprint:store.fingerprint(),message:'已从私有原图准备无水印展示缓存；商品记录、原图和旧展示图未修改，未发布。'});}
   else if(pathname==='/api/product/status'){store.preparePhase2();result=store.setStatus(body.id,body.status,body.revision);}
   else if(pathname==='/api/backup/full'){return send(200,archives.start(body.revision));}
   else if(pathname==='/api/backup/full/restore'){result=await archives.restore(body);}
   else if(pathname==='/api/backup')result=store.backup(body.revision);
   else if(pathname==='/api/restore'){const p=body.file?(store.names().includes(body.file)?unpack(fs.readFileSync(path.join(store.snapshots,body.file))):null):unpack(JSON.stringify(body.backup));if(!p)throw new StoreError(400,'快照不存在');photos.validateRefs([...p.products,...(p.publication?.products||[])].flatMap(p=>[p.photos.cover,...p.photos.common,...Object.values(p.photos.variants).flat()]).filter(Boolean));result=store.restore(body);}
   else return send(404,{error:'本阶段不提供永久删除原图或发布接口'});
   return send(200,{catalog:result,fingerprint:store.fingerprint(),message:'已保存到本地商品库；尚未同步顾客网站或正式发布'});
  }catch(error){const diagnostic=(!error.status||error.status>=500)?recordFailure(store.dir,error,operation):null;return send(error.status||500,{error:diagnostic?(error instanceof StoreError?error.message+' ':'')+diagnostic.message:error.message,...(diagnostic?{diagnostic:{id:diagnostic.id,stage:diagnostic.stage,code:diagnostic.code,logSaved:diagnostic.logSaved}}:{}),fingerprint:store.fingerprint()});}
 });
 server.requestTimeout=0;return {server,store,photos,archives,publication,online,launchToken:session};
}
export async function startAdmin({dataDir=defaultDataDir(),port=3100,open=true}={}){
 const app=createAdminServer({dataDir});
 // One explicit local port avoids silently opening a second management process.
 try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});}
 catch(error){if(error.code==='EADDRINUSE')throw Error('3100管理端口已被占用。若管理台已经打开，请继续使用原窗口；否则关闭原管理窗口后重试。顾客网站3000端口不受影响。');throw error;}
 const address='http://127.0.0.1:'+app.server.address().port+'/#'+app.launchToken;
 console.log(brandConfig.name+' V'+releaseInfo.version+' 本地商品管理 · '+(releaseInfo.adminPatch||'')+'\n管理入口：'+address+'\n私有商品库：'+app.store.dir+'\n仅本机访问；此随机授权入口仅本次启动有效，请勿转发。保存不发布。关闭管理台服务请在本窗口按Ctrl+C。');
 if(open&&process.platform==='win32')spawn('explorer.exe',[address],{stdio:'ignore',detached:true}).on('error',()=>{}).unref();return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startAdmin().catch(error=>{console.error(error.message);process.exitCode=1;});
