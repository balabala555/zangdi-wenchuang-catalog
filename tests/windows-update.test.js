import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,rmSync,cpSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {safeMigrate,migrationTarget,safeUpdate,safeRecover,BRANCH} from '../scripts/local-preview.mjs';
import {managedPreview,stopManagedPreview,writeRuntime,clearRuntime,availablePort} from '../scripts/preview-control.mjs';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'}).trim();
const pkg=version=>JSON.stringify({name:'zangdi-wenchuang-catalog',version,type:'module'});
const validateCandidate=root=>assert.equal(JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).name,'zangdi-wenchuang-catalog');
function fixture(){
 const temp=mkdtempSync(path.join(tmpdir(),'windows-zip-')),remote=path.join(temp,'remote.git'),seed=path.join(temp,'seed');mkdirSync(seed);git(temp,'init','--bare',remote);git(seed,'init');git(seed,'config','user.email','fixture@example.test');git(seed,'config','user.name','Fixture');git(seed,'checkout','-b',BRANCH);writeFileSync(path.join(seed,'package.json'),pkg('1.3.2'));git(seed,'add','.');git(seed,'commit','-m','old');git(seed,'remote','add','origin',remote);git(seed,'push','origin',BRANCH);return {temp,remote,seed};
}
test('ZIP with Chinese/spaces migrates without overwriting originals, then fast-forwards and recovers with private backups',()=>{
 const {temp,remote,seed}=fixture();try{
 const zip=path.join(temp,'下载目录','老网站 (12)'),target=path.join(temp,'固定 Git 目录');mkdirSync(path.join(zip,'.private-originals'),{recursive:true});writeFileSync(path.join(zip,'package.json'),pkg('1.3.2'));writeFileSync(path.join(zip,'我的资料.txt'),'keep exact personal data');writeFileSync(path.join(zip,'.private-originals','photo.png'),'private original fixture');
 const result=safeMigrate(zip,target,{repo:remote,validateCandidate});assert.equal(result.migrated,true);assert.equal(result.root,target);assert.ok(existsSync(path.join(target,'.git')));assert.equal(readFileSync(path.join(zip,'我的资料.txt'),'utf8'),'keep exact personal data');assert.equal(readFileSync(path.join(result.migrationBackup,'files','.private-originals','photo.png'),'utf8'),'private original fixture');assert.ok(!existsSync(path.join(target,'.private-originals')),'Never publish/merge old private files into clone');
 const restoredZip=safeRecover(target,{repo:remote});assert.equal(readFileSync(path.join(restoredZip.root,'我的资料.txt'),'utf8'),'keep exact personal data');assert.ok(existsSync(path.join(target,'.git')));
 writeFileSync(path.join(seed,'package.json'),pkg('1.3.3'));git(seed,'add','.');git(seed,'commit','-m','new');git(seed,'push','origin',BRANCH);
 const next=safeUpdate(target,{repo:remote,validateCandidate});assert.equal(next.version,'1.3.3');assert.ok(existsSync(path.join(next.snapshot,'repository.bundle')));assert.equal(JSON.parse(readFileSync(path.join(next.snapshot,'files','package.json'))).version,'1.3.2');
 const restored=safeRecover(target,{repo:remote});assert.notEqual(restored.root,target);assert.equal(restored.version,'1.3.2');assert.equal(JSON.parse(readFileSync(path.join(target,'package.json'))).version,'1.3.3');
 writeFileSync(path.join(target,'个人修改.txt'),'do not overwrite');assert.throws(()=>safeUpdate(target,{repo:remote,validateCandidate}),/本地修改/);assert.equal(readFileSync(path.join(target,'个人修改.txt'),'utf8'),'do not overwrite');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('ZIP clone/network failure and occupied migration target preserve all original files and backups',()=>{
 const temp=mkdtempSync(path.join(tmpdir(),'windows-failure-'));try{
 const source=path.join(temp,'ZIP'),target=path.join(temp,'Git');mkdirSync(source);writeFileSync(path.join(source,'package.json'),pkg('1.3.2'));writeFileSync(path.join(source,'photo.jpg'),'original');
 assert.throws(()=>safeMigrate(source,target,{repo:path.join(temp,'missing-remote.git'),validateCandidate}),/迁移未完成/);assert.equal(readFileSync(path.join(source,'photo.jpg'),'utf8'),'original');assert.ok(!existsSync(target));assert.ok(readdirSync(source+'-backups').length>0);
 mkdirSync(target);writeFileSync(path.join(target,'personal.txt'),'existing');assert.throws(()=>safeMigrate(source,target),/不会覆盖/);assert.equal(readFileSync(path.join(target,'personal.txt'),'utf8'),'existing');
 mkdirSync(path.join(temp,'zangdi-preview'));assert.equal(migrationTarget(temp),path.join(temp,'zangdi-preview-git'));
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('failed candidate validation leaves version intact; recover copy preserves concurrent personal changes',()=>{
 const {temp,remote,seed}=fixture();try{
 const source=path.join(temp,'ZIP'),target=path.join(temp,'Git');mkdirSync(source);writeFileSync(path.join(source,'package.json'),pkg('1.3.2'));safeMigrate(source,target,{repo:remote,validateCandidate});
 const before=git(target,'rev-parse','HEAD');writeFileSync(path.join(seed,'package.json'),pkg('1.3.3'));git(seed,'add','.');git(seed,'commit','-m','next');git(seed,'push','origin',BRANCH);
 assert.throws(()=>safeUpdate(target,{repo:remote,validateCandidate:()=>{throw Error('fixture invalid candidate');}}),/更新未完成/);assert.equal(git(target,'rev-parse','HEAD'),before);writeFileSync(path.join(target,'个人修改.txt'),'concurrent keep');
 const restored=safeRecover(target,{repo:remote});assert.equal(restored.commit,before);assert.equal(readFileSync(path.join(target,'个人修改.txt'),'utf8'),'concurrent keep');assert.equal(JSON.parse(readFileSync(path.join(restored.root,'package.json'))).version,'1.3.2');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('managed server stops only with its root and token; closed/stale metadata and unrelated ports do not block update',async()=>{
 const temp=mkdtempSync(path.join(tmpdir(),'managed-server-'));let child,unrelated;const token=randomUUID();
 try{
  for(const file of ['package.json','server.js','build.js'])cpSync(new URL('../'+file,import.meta.url),path.join(temp,file));cpSync(new URL('../src',import.meta.url),path.join(temp,'src'),{recursive:true});
  const port=await availablePort(24500);child=spawn(process.execPath,['server.js'],{cwd:temp,stdio:'ignore',env:{...process.env,PORT:String(port),BASE_PATH:'/',CATALOG_PREVIEW_TOKEN:token,CATALOG_PREVIEW_VERSION:'1.3.3'}});
  const exited=new Promise(r=>child.once('exit',r));writeRuntime(temp,{token,port});for(let i=0;i<80&&!await managedPreview(temp);i++)await new Promise(r=>setTimeout(r,50));assert.ok(await managedPreview(temp));
  const url='http://127.0.0.1:'+port;assert.equal((await fetch(url+'/.catalog-control/stop',{method:'POST'})).status,404);assert.equal((await fetch(url+'/.catalog-control',{headers:{'X-Catalog-Token':token,Origin:'https://example.test'}})).status,404);
  writeRuntime(temp,{token:'incorrect',port});assert.equal((await stopManagedPreview(temp)).stopped,false);assert.equal(child.exitCode,null);writeRuntime(temp,{token,port});assert.equal((await stopManagedPreview(temp)).stopped,true);await exited;
  assert.equal((await stopManagedPreview(temp)).stopped,false,'Already closed process is safe');writeRuntime(temp,{token,port});assert.equal((await stopManagedPreview(temp)).stopped,false,'Stale state after reboot is safe');
  unrelated=net.createServer(socket=>socket.destroy());await new Promise(r=>unrelated.listen(port,'0.0.0.0',r));assert.equal((await stopManagedPreview(temp)).stopped,false);assert.ok(await availablePort(port)>port);assert.ok(unrelated.listening);
 }finally{clearRuntime(temp,token);child?.kill();if(unrelated)await new Promise(r=>unrelated.close(r));rmSync(temp,{recursive:true,force:true});}
});
test('Windows migration CMD uses UTF-8 and CRLF, no administrator or manual git init commands',()=>{
 const bytes=readFileSync('06-migrate.cmd'),text=bytes.toString('utf8');assert.ok(text.includes('\r\n'));assert.ok(text.includes('chcp 65001'));assert.ok(text.includes('node scripts\\local-preview.mjs install'));assert.ok(!/runas|git init|reset --hard|taskkill/i.test(text));
});

test('legacy V1.3.2 recovery metadata also restores an independent copy without losing current edits',()=>{
 const {temp,remote}=fixture();try{
  const source=path.join(temp,'ZIP'),target=path.join(temp,'Git');mkdirSync(source);writeFileSync(path.join(source,'package.json'),pkg('1.3.2'));const result=safeMigrate(source,target,{repo:remote,validateCandidate});
  writeFileSync(path.join(target,'.git','zangdi-preview-recovery.json'),JSON.stringify({previous:result.commit,backup:'legacy-backup'}));writeFileSync(path.join(target,'个人修改.txt'),'keep existing edits');
  const restored=safeRecover(target,{repo:remote});assert.notEqual(restored.root,target);assert.equal(restored.commit,result.commit);assert.equal(readFileSync(path.join(target,'个人修改.txt'),'utf8'),'keep existing edits');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
