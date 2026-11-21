import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {backupProject,recoverCopy} from '../scripts/preview-backup.mjs';
import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CatalogStore,categories,cents,codeRoot} from '../admin/store.mjs';
import {createAdminServer} from '../admin/server.mjs';
import {createServer} from '../server.js';
import {products} from '../src/data.js';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'catalog-admin-test-'));
const input=(p={})=>({name:'自动化隔离测试商品',category:categories[0],price:'19.90',unit:'个',size:'测试尺寸',material:'测试材质',description:'仅在临时测试目录，不进入实际商品库',status:'off_sale',variants:[{name:'测试款式'}],...p});
const from=p=>({...p,price:(p.priceCents/100).toFixed(2)});
const setup=()=>{const dir=temp();return {dir,store:new CatalogStore(dir)};};
test('admin imports existing nine products exactly once with stable identities and protected photo references',()=>{const {dir,store}=setup();try{
 const data=store.read();assert.equal(data.products.length,products.length);for(const old of products){const p=data.products.find(p=>p.id===old.id);assert.equal(p.name,old.name);assert.equal(p.priceCents,Math.round(old.price*100));assert.equal(p.category,old.category);assert.equal(p.subtitle,old.subtitle||'');assert.equal(p.tag,old.tag||'');assert.equal(p.material,old.material);assert.equal(p.size,old.size);assert.deepEqual(p.variants.map(v=>v.name),old.variants);assert.equal(p.photos.cover,old.coverImage||old.image||null);}
 assert.equal(new CatalogStore(dir).read().revision,data.revision);assert.equal(store.list().items.length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('admin creates/edits/statuses persist across restarts; style rename keeps ID, photos and aliases',()=>{const {dir,store}=setup();try{
 let p=store.save(input(),null,store.read().revision);const item=p.products.at(-1);assert.equal(item.priceCents,1990);assert.equal(item.status,'off_sale');
 p=store.save(input({status:'sold_out',variants:item.variants}),item.id,p.revision);assert.equal(new CatalogStore(dir).read().products.at(-1).status,'sold_out');
 const bag=p.products.find(p=>p.id==='felt-mushroom-bag'),id=bag.variants[0].id,photo=JSON.stringify(bag.photos);const variants=bag.variants.map((v,i)=>({...v,name:i?'原款'+i:'测试改名'}));
 p=store.save(from({...bag,variants}),bag.id,p.revision);const renamed=p.products.find(p=>p.id===bag.id);assert.equal(renamed.variants[0].id,id);assert.ok(renamed.variants[0].aliases.includes('浅灰色'));assert.equal(JSON.stringify(renamed.photos),photo);
 p=store.save(from({...renamed,variants:renamed.variants.slice(1)}),bag.id,p.revision);assert.ok(p.products.find(p=>p.id===bag.id).retiredVariants.some(v=>v.id===id));assert.equal(store.list().items.length,5);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('admin rejects invalid prices/categories/duplicate styles and stale windows without overwriting',()=>{const {dir,store}=setup();try{
 const start=store.read(),fp=store.fingerprint();for(const price of ['0','-1','1.234','NaN'])assert.throws(()=>store.save(input({price}),null,start.revision));assert.throws(()=>store.save(input({category:'未知分类'}),null,start.revision));assert.throws(()=>store.save(input({variants:[{name:'相同'},{name:'相同'}]}),null,start.revision));assert.equal(store.fingerprint(),fp);assert.equal(store.list().items.length,1);
 store.save(input(),null,start.revision);assert.throws(()=>new CatalogStore(dir).save(input(),null,start.revision),e=>e.status===409);assert.equal(store.read().products.length,start.products.length+1);assert.equal(cents('0.10'),10);assert.equal(cents('90'),9000);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('admin snapshots and downloaded backup recover as new versions; no implicit overwrite or permanent loss',()=>{const {dir,store}=setup();try{
 const old=store.download(),initial=store.list().items[0];let data=store.save(input(),null,store.read().revision);store.backup(data.revision);assert.throws(()=>store.restore({file:initial.file,expectedFingerprint:store.fingerprint(),confirm:false}));
 assert.throws(()=>store.restore({backup:null,expectedFingerprint:store.fingerprint(),confirm:true}),e=>e.status===400);const count=store.names().length;data=store.restore({file:initial.file,expectedFingerprint:store.fingerprint(),confirm:true});assert.equal(data.products.length,products.length);assert.equal(store.names().length,count+1);
 assert.throws(()=>store.restore({backup:{...old,sha256:'wrong'},expectedFingerprint:store.fingerprint(),confirm:true}));assert.throws(()=>store.restore({file:'../../outside',expectedFingerprint:store.fingerprint(),confirm:true}));assert.throws(()=>store.restore({backup:old,expectedFingerprint:'stale',confirm:true}));
 data=store.restore({backup:old,expectedFingerprint:store.fingerprint(),confirm:true});assert.equal(data.products.length,products.length);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('admin corrupted pointer never silently reimports; valid snapshots stay available and can recover',()=>{const {dir,store}=setup();try{
 const snapshot=store.list().items[0];fs.writeFileSync(store.pointer,'broken pointer');assert.throws(()=>new CatalogStore(dir).read(),e=>e.status===503);assert.equal(fs.readFileSync(store.pointer,'utf8'),'broken pointer');assert.equal(store.list().items.length,1);
 store.restore({file:snapshot.file,expectedFingerprint:store.fingerprint(),confirm:true});assert.equal(store.read().products.length,products.length);assert.equal(fs.readdirSync(path.join(dir,'recovery-records')).length,1);
 const next=store.list().items[0];fs.writeFileSync(path.join(store.snapshots,next.file),'broken snapshot');assert.equal(store.list().invalid,1);assert.throws(()=>store.read(),e=>e.status===503);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('admin stale write locks recover, live writers block, and data inside code is forbidden',()=>{const {dir,store}=setup();try{
 fs.writeFileSync(store.lock,JSON.stringify({pid:process.pid,nonce:'live'}));assert.throws(()=>store.save(input(),null,store.read().revision),e=>e.status===409);fs.writeFileSync(store.lock,JSON.stringify({pid:99999999,nonce:'dead'}));store.save(input(),null,store.read().revision);assert.ok(fs.readdirSync(dir).some(f=>f.startsWith('write.lock.stale-')));assert.ok(!fs.existsSync(store.lock));
 assert.throws(()=>new CatalogStore(path.join(codeRoot,'public','should-not-exist')),/项目之外/);assert.ok(!fs.existsSync(path.join(codeRoot,'public','should-not-exist')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
async function web(){const dir=temp(),app=createAdminServer({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;const response=await fetch(origin+'/api/open-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:app.launchToken})});const cookie=response.headers.get('set-cookie').split(';')[0];await response.text();const session=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json();const request=(route,body,headers={})=>fetch(origin+route,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return {...app,dir,origin,cookie,session,request,close:async()=>{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}};}
test('admin API binds loopback, authenticates local session, blocks CSRF/foreign Host and unsafe media',async()=>{const app=await web();try{
 assert.equal(app.server.address().address,'127.0.0.1');assert.equal((await fetch(app.origin)).headers.get('set-cookie'),null);assert.equal((await app.request('/api/open-session',{token:'wrong'})).status,401);assert.equal((await fetch(app.origin+'/api/catalog')).status,401);assert.equal((await app.request('/api/session',null,{Origin:'https://evil.test'})).status,403);assert.equal(await new Promise((resolve,reject)=>{const req=http.get(app.origin+'/api/catalog',{headers:{Host:'evil.test',Cookie:app.cookie}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);}),403);
 const data=app.store.read();assert.equal((await app.request('/api/product/save',{product:input(),revision:data.revision},{'X-CSRF-Token':'invalid'})).status,403);assert.equal((await app.request('/api/product/save',{product:input(),revision:data.revision},{Origin:'https://evil.test'})).status,403);assert.equal(app.store.read().revision,data.revision);
 assert.equal((await app.request('/media?path=../../.private-originals/photo.jpg')).status,404);assert.equal((await app.request('/api/publish',{})).status,404);assert.equal((await app.request('/api/upload',{})).status,404);
 assert.equal((await app.request('/api/product/save',{product:input(),revision:data.revision})).status,200);assert.equal(app.store.read().products.length,products.length+1);
 }finally{await app.close();}});
test('admin API backup/recovery stays available after catalog corruption and requires explicit confirmation',async()=>{const app=await web();try{
 const snapshots=await(await app.request('/api/backups')).json();fs.writeFileSync(app.store.pointer,'corrupt');assert.equal((await app.request('/api/catalog')).status,503);const unavailable=await app.request('/api/backup/download');assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('content-disposition'),null);assert.equal((await app.request('/api/backups')).status,200);
 const body={file:snapshots.items[0].file,expectedFingerprint:app.store.fingerprint()};assert.equal((await app.request('/api/restore',body)).status,400);assert.equal((await app.request('/api/restore',{...body,confirm:true})).status,200);const backup=await app.request('/api/backup/download');assert.match(backup.headers.get('content-disposition'),/attachment/);assert.equal((await backup.json()).payload.products.length,products.length);
 }finally{await app.close();}});
test('customer server never exposes local administration routes, pages or private data',async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const origin='http://127.0.0.1:'+server.address().port;for(const route of ['/admin/','/admin/server.mjs','/api/catalog','/api/product/save','/.private-originals/'])assert.equal((await fetch(origin+route)).status,404);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}});
test('Windows admin launcher needs Node only and preserves existing update entrypoints',()=>{const cmd=fs.readFileSync('07-admin.cmd','utf8');assert.ok(cmd.includes('\r\n'));assert.ok(cmd.includes('node admin\\launch.mjs'));assert.ok(!/npm install|sharp|runas/i.test(cmd));});

test('admin interrupted pointer replacement leaves current version usable and its new snapshot recoverable',()=>{const {dir,store}=setup();const rename=fs.renameSync;try{
 const before=store.read(),fingerprint=store.fingerprint();fs.renameSync=(a,b)=>{if(b===store.pointer)throw Object.assign(Error('simulated file lock'),{code:'EACCES'});return rename(a,b);};assert.throws(()=>store.save(input(),null,before.revision),/simulated/);fs.renameSync=rename;
 assert.equal(store.fingerprint(),fingerprint);assert.equal(store.read().revision,before.revision);assert.equal(store.list().items.length,2);assert.ok(!fs.existsSync(store.lock));const next=store.save(input(),null,before.revision);assert.equal(next.revision,3);
 }finally{fs.renameSync=rename;fs.rmSync(dir,{recursive:true,force:true});}});
test('software backup and recovery never overwrite independent merchant data',()=>{const root=temp();try{
 const program=path.join(root,'program'),dir=path.join(root,'private-merchant');fs.mkdirSync(program);fs.writeFileSync(path.join(program,'package.json'),JSON.stringify({name:'zangdi-wenchuang-catalog',version:'1.4.0'}));const store=new CatalogStore(dir);store.save(input(),null,store.read().revision);const fingerprint=store.fingerprint(),snapshot=backupProject(program,{version:'1.4.0'});fs.writeFileSync(path.join(program,'package.json'),'simulated software update');recoverCopy(snapshot);assert.equal(new CatalogStore(dir).fingerprint(),fingerprint);assert.equal(store.read().products.length,products.length+1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}});

test('admin starts from an independent project copy without node_modules and persists only outside code',()=>{const root=temp();try{
 const program=path.join(root,'Windows 测试副本'),data=path.join(root,'独立商品库');fs.mkdirSync(program);for(const name of ['package.json','admin','src','public'])fs.cpSync(new URL('../'+name,import.meta.url),path.join(program,name),{recursive:true});
 const code=`import {startAdmin} from ${JSON.stringify(pathToFileURL(path.join(program,'admin/server.mjs')).href)};const app=await startAdmin({dataDir:${JSON.stringify(data)},port:0,open:false});try{const origin='http://127.0.0.1:'+app.server.address().port;const r=await fetch(origin+'/api/open-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:app.launchToken})});if(r.status!==200)throw Error('Auth failed');const cookie=r.headers.get('set-cookie').split(';')[0];const d=await(await fetch(origin+'/api/catalog',{headers:{Cookie:cookie}})).json();if(d.catalog.products.length!==9)throw Error('Catalog failed');console.log('PASS isolated no-dependency admin');}finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}`;
 assert.match(execFileSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'}),/PASS isolated no-dependency admin/);assert.ok(fs.existsSync(path.join(data,'CURRENT')));assert.ok(!fs.existsSync(path.join(program,'node_modules')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}});
