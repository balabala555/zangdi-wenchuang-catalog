import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {CatalogStore,categories} from '../admin/store.mjs';
import {PhotoLibrary,assetMeta,assetPath,sha} from '../admin/assets.mjs';
import {createAdminServer} from '../admin/server.mjs';
import {recordFailure} from '../admin/diagnostics.mjs';
const fixture=()=>fs.mkdtempSync(path.join(os.tmpdir(),'admin-upload-fix-'));
const image=()=>sharp({create:{width:640,height:800,channels:3,background:'#849b88'}}).png().toBuffer();
function windowsFlush({fail=false}={}){
 const original={open:fs.openSync,sync:fs.fsyncSync,close:fs.closeSync},handles=new Map(),seen=[],closed=[];
 fs.openSync=function(file,flags,...args){const fd=original.open.call(fs,file,flags,...args);if(String(file).includes('.pending-'))handles.set(fd,{flags,file});return fd;};
 fs.fsyncSync=function(fd){const entry=handles.get(fd);if(entry){seen.push(entry.flags);if(fail||entry.flags==='r'){const error=Error('private path/token must never be logged');error.code=fail?'EIO':'EPERM';error.syscall='fsync';throw error;}}return original.sync.call(fs,fd);};
 fs.closeSync=function(fd){if(handles.has(fd)){closed.push(fd);handles.delete(fd);}return original.close.call(fs,fd);};
 return {seen,handles,closed,restore(){fs.openSync=original.open;fs.fsyncSync=original.sync;fs.closeSync=original.close;}};
}
test('Windows writable flush rule: photo upload succeeds without truncating original bytes; product catalogue unchanged',async()=>{
 const dir=fixture();let guard;try{const store=new CatalogStore(dir),before=store.fingerprint(),photos=new PhotoLibrary(dir),bytes=await image(),file=path.join(dir,'raw.png');fs.writeFileSync(file,bytes);guard=windowsFlush();const uploaded=await photos.upload(file,'实拍.png'),m=assetMeta(dir,uploaded.ref,true);assert.equal(guard.seen.length,5);assert.ok(guard.seen.every(f=>f==='r+'));assert.equal(guard.handles.size,0);assert.equal(sha(fs.readFileSync(path.join(assetPath(dir,uploaded.ref),m.original))),sha(bytes));assert.equal(store.fingerprint(),before);assert.equal(m.renditions.detail.mark.layers,1);
 }finally{guard?.restore();fs.rmSync(dir,{recursive:true,force:true});}
});
test('HTTP upload flush failure logs its stage/code and closes handle; ten original products and prior photos survive retry/restart',async()=>{
 const dir=fixture(),app=createAdminServer({dataDir:dir});let guard;const capture=[],log=console.error;console.error=s=>capture.push(s);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{let current=app.store.read();app.store.save({name:'测试商品001',category:categories[1],price:'9',status:'on_sale',variants:[{name:'默认款'}]},null,current.revision);const bytes=await image(),file=path.join(dir,'old.png');fs.writeFileSync(file,bytes);const previous=await app.photos.upload(file,'原有照片.png');const baseline=app.store.fingerprint(),originalFiles=assetMeta(dir,previous.ref,true).files;
 const origin=`http://127.0.0.1:${app.server.address().port}`,auth=await fetch(origin+'/api/open-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:app.launchToken})}),cookie=auth.headers.get('set-cookie').split(';')[0],session=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json(),headers={Cookie:cookie,Origin:origin,'X-CSRF-Token':session.csrf,'X-File-Name':encodeURIComponent('私有照片名字.png')};
 const newer=await sharp(bytes).modulate({brightness:.8}).png().toBuffer();guard=windowsFlush({fail:true});const response=await fetch(origin+'/api/photo/upload',{method:'POST',headers,body:newer}),body=await response.json();assert.equal(response.status,500);assert.equal(body.diagnostic.stage,'photo-sync');assert.equal(body.diagnostic.code,'EIO');assert.match(body.error,/刷新照片文件写入/);assert.ok(body.diagnostic.logSaved);assert.equal(guard.handles.size,0);guard.restore();guard=null;
 assert.equal(app.store.fingerprint(),baseline);assert.equal(app.store.read().products.length,10);assert.deepEqual(assetMeta(dir,previous.ref,true).files,originalFiles);const logText=fs.readFileSync(path.join(dir,'diagnostics/errors.jsonl'),'utf8'),entry=JSON.parse(logText.trim());assert.equal(entry.id,body.diagnostic.id);for(const secret of [app.launchToken,session.csrf,cookie,dir,'私有照片名字','private path/token']){assert.ok(!logText.includes(secret));assert.ok(!capture.join('\n').includes(secret));assert.ok(!JSON.stringify(body).includes(secret));}
 const retried=await fetch(origin+'/api/photo/upload',{method:'POST',headers,body:newer});assert.equal(retried.status,200);assert.equal(app.photos.list().length,2);assert.equal(new CatalogStore(dir).read().products.length,10);assert.ok(capture[0].includes('photo-sync'));
 }finally{guard?.restore();console.error=log;app.server.closeAllConnections();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
test('diagnostic write failure still prints sanitized correlation information without hiding the original code',()=>{
 const dir=fixture(),log=console.error,capture=[];console.error=s=>capture.push(s);try{fs.writeFileSync(path.join(dir,'diagnostics'),'blocked');const error=Error('Authorization: secret /private/photo.png');error.code='EACCES';error.adminStage='photo-original';const result=recordFailure(dir,error);assert.equal(result.logSaved,false);assert.equal(result.code,'EACCES');assert.match(result.message,/日志文件未能写入/);assert.equal(capture.length,1);assert.ok(!capture[0].includes('Authorization'));assert.ok(!capture[0].includes('/private/photo.png'));}finally{console.error=log;fs.rmSync(dir,{recursive:true,force:true});}
});
test('temporary upload cleanup failure cannot turn a completed upload into failure or expose its filename',async()=>{
 const dir=fixture(),app=createAdminServer({dataDir:dir}),unlink=fs.unlinkSync,log=console.error,capture=[];console.error=s=>capture.push(s);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const origin=`http://127.0.0.1:${app.server.address().port}`,auth=await fetch(origin+'/api/open-session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:app.launchToken})}),cookie=auth.headers.get('set-cookie').split(';')[0],session=await(await fetch(origin+'/api/session',{headers:{Cookie:cookie}})).json(),bytes=await image();fs.unlinkSync=function(file){if(String(file).endsWith('.upload')){const error=Error('sensitive temporary path');error.code='EACCES';throw error;}return unlink.call(fs,file);};const response=await fetch(origin+'/api/photo/upload',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':session.csrf},body:bytes});assert.equal(response.status,200);const body=await response.json();assetMeta(dir,body.ref,true);assert.equal(app.store.read().products.length,9);assert.equal(app.photos.list().length,1);const entry=JSON.parse(fs.readFileSync(path.join(dir,'diagnostics/errors.jsonl'),'utf8').trim());assert.equal(entry.stage,'photo-cleanup');assert.equal(entry.code,'EACCES');assert.ok(!capture.join('').includes('sensitive temporary path'));
 }finally{fs.unlinkSync=unlink;console.error=log;app.server.closeAllConnections();await new Promise(r=>app.server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
