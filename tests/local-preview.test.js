import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {safeUpdate,safeRecover,safeSetup,BRANCH,requireStopped} from '../scripts/local-preview.mjs';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
test('fixed-directory updates fast-forward with recovery, refuse user edits/divergence/wrong remotes',()=>{
 const temp=mkdtempSync(path.join(tmpdir(),'zangdi-preview-'));try{
 const remote=path.join(temp,'remote.git'),seed=path.join(temp,'seed'),local=path.join(temp,'本地 测试');mkdirSync(seed);git(temp,'init','--bare',remote);git(seed,'init');git(seed,'config','user.email','fixture@example.test');git(seed,'config','user.name','Fixture');git(seed,'checkout','-b',BRANCH);
 writeFileSync(path.join(seed,'package.json'),JSON.stringify({name:'zangdi-wenchuang-catalog',version:'1.3.0'}));git(seed,'add','.');git(seed,'commit','-m','initial');git(seed,'remote','add','origin',remote);git(seed,'push','origin',BRANCH);
 safeSetup(local,{repo:remote,validateCandidate:()=>{}});const original=git(local,'rev-parse','HEAD');assert.equal(safeUpdate(local,{repo:remote,validateCandidate:()=>{}}).updated,false);
 writeFileSync(path.join(seed,'version.txt'),'next');git(seed,'add','.');git(seed,'commit','-m','next');git(seed,'push','origin',BRANCH);
 assert.equal(safeUpdate(local,{repo:remote,validateCandidate:()=>{}}).updated,true);const newest=git(local,'rev-parse','HEAD');assert.notEqual(newest,original);assert.equal(safeRecover(local,{repo:remote,validateCandidate:()=>{}}).commit,original);assert.equal(git(local,'rev-parse',BRANCH),newest);
 git(local,'switch',BRANCH);writeFileSync(path.join(local,'my-photo-note.txt'),'keep me');assert.throws(()=>safeUpdate(local,{repo:remote,validateCandidate:()=>{}}),/本地修改/);assert.equal(readFileSync(path.join(local,'my-photo-note.txt'),'utf8'),'keep me');rmSync(path.join(local,'my-photo-note.txt'));
 assert.throws(()=>safeUpdate(local,{repo:'https://example.test/wrong.git'}),/远程仓库/);
 git(local,'config','user.email','fixture@example.test');git(local,'config','user.name','Fixture');writeFileSync(path.join(local,'local.txt'),'local');git(local,'add','.');git(local,'commit','-m','local divergence');assert.throws(()=>safeUpdate(local,{repo:remote,validateCandidate:()=>{}}),/分叉/);
 const other=path.join(temp,'nonempty');mkdirSync(other);writeFileSync(path.join(other,'personal.txt'),'untouched');assert.throws(()=>safeSetup(other,{repo:remote,validateCandidate:()=>{}}),/非空/);assert.equal(readFileSync(path.join(other,'personal.txt'),'utf8'),'untouched');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('updater refuses while a preview port is listening',async()=>{const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await assert.rejects(requireStopped(server.address().port),/预览端口仍在使用/);}finally{await new Promise(r=>server.close(r));}});
test('direct Node preview starts from a project copy without node_modules',()=>{
 const temp=mkdtempSync(path.join(tmpdir(),'zangdi-node-only-'));
 try{
  for(const file of ['package.json','server.js','build.js','index.html'])cpSync(new URL('../'+file,import.meta.url),path.join(temp,file));
  cpSync(new URL('../src',import.meta.url),path.join(temp,'src'),{recursive:true});
  cpSync(new URL('../public',import.meta.url),path.join(temp,'public'),{recursive:true});
  const code=`import {createServer} from ${JSON.stringify(pathToFileURL(path.join(temp,'server.js')).href)};const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));try{const r=await fetch('http://127.0.0.1:'+s.address().port);if(r.status!==200 || !(await r.text()).includes('扎西德勒鸭·藏地选物'))throw Error('Preview failed');const preview=await fetch('http://127.0.0.1:'+s.address().port+'/preview.html');if(preview.status!==200 || !(await preview.text()).includes('embeddedBrandAssets'))throw Error('Standalone preview failed');console.log('PASS no node_modules preview');}finally{await new Promise(r=>s.close(r));}`;
  assert.match(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:temp,encoding:'utf8'}),/PASS no node_modules/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
