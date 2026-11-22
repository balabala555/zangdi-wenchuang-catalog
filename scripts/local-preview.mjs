// Local preview only: no push, deployment, force reset or overwrite of ZIP projects.
import {execFileSync,spawn} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,mkdirSync,writeFileSync,mkdtempSync,renameSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {backupProject,recoverCopy,unique} from './preview-backup.mjs';
import {managedPreview,stopManagedPreview,availablePort,writeRuntime,clearRuntime} from './preview-control.mjs';
export const REPO='https://github.com/balabala555/zangdi-wenchuang-catalog.git',BRANCH='test/vi-v1.3.0';
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const project=root=>{let p;try{p=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));}catch{throw Error('没有找到有效网站项目。请重新选择能看到02-start.cmd和package.json的原网站文件夹。');}if(p.name!=='zangdi-wenchuang-catalog')throw Error('所选文件夹不是网站项目，请选择含package.json和02-start.cmd的文件夹。');return p;};
export function inspect(root,{repo=REPO}={}){
 const p=project(root);if(!existsSync(path.join(root,'.git')))throw Error('这是ZIP解压版，需要一次性迁移；新版03更新和安装包可自动处理，不要手动git init。');
 const top=git(root,['rev-parse','--show-toplevel']);if(path.relative(path.resolve(top),path.resolve(root))!=='')throw Error('请在项目根目录操作。');
 if(git(root,['remote','get-url','origin']).replace(/\.git$/,'')!==repo.replace(/\.git$/,''))throw Error('远程仓库不匹配，已停止。');
 return {root,version:p.version,branch:git(root,['branch','--show-current']),commit:git(root,['rev-parse','HEAD'])};
}
function clean(root){if(git(root,['status','--porcelain','--untracked-files=normal']))throw Error('有本地修改或未跟踪文件，不会覆盖。请保留文件并反馈提示。');}
export function verifyCandidate(root){
 project(root);const gate=path.join(root,'scripts/verify-release.mjs');if(!existsSync(gate))throw Error('下载版本缺少版本保护检查，已停止。');
 execFileSync(process.execPath,[gate],{cwd:root,stdio:'pipe'});
}
function candidate(root,next,validate){
 const temp=mkdtempSync(path.join(os.tmpdir(),'zangdi-candidate-'));
 try{git(temp,['clone','--shared','--no-checkout',root,path.join(temp,'repo')]);git(path.join(temp,'repo'),['checkout','--detach',next]);validate(path.join(temp,'repo'));}finally{rmSync(temp,{recursive:true,force:true});}
}
export function safeUpdate(root,options={}){
 const before=inspect(root,options);clean(root);if(before.branch!==BRANCH)throw Error('当前不在测试分支；请使用05返回测试版本，不会自动覆盖恢复分支。');
 git(root,['fetch','origin',`refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
 const next=git(root,['rev-parse',`refs/remotes/origin/${BRANCH}`]);
 try{git(root,['merge-base','--is-ancestor',before.commit,next]);}catch{throw Error('本地与远程存在分叉，已停止，不会强制覆盖。');}
 if(next===before.commit)return {...before,updated:false};
 const snapshot=backupProject(root,before),backup='backup/preview-'+unique();git(root,['branch',backup,before.commit]);
 const file=path.resolve(root,git(root,['rev-parse','--git-path','zangdi-preview-recovery.json']));writeFileSync(file,JSON.stringify({previous:before.commit,updated:next,backup,snapshot},null,2));
 options.onProgress?.('更新前完整备份：'+snapshot);
 try{
  candidate(root,next,options.validateCandidate||verifyCandidate);clean(root);
  if(git(root,['rev-parse','HEAD'])!==before.commit)throw Error('备份期间分支发生变化，已停止。');
  git(root,['merge','--ff-only',next]);return {...inspect(root,options),updated:true,backup,snapshot};
 }catch(error){throw Error('更新未完成：'+error.message+'\n原始备份保留在 '+snapshot+'\n可双击04恢复至独立目录，不会覆盖当前文件。');}
}
export function safeRecover(root,options={}){
 const file=path.resolve(root,git(root,['rev-parse','--git-path','zangdi-preview-recovery.json']));if(!existsSync(file))throw Error('尚无更新恢复点，原文件未改变。');
 const info=JSON.parse(readFileSync(file,'utf8'));if(info.snapshot)return recoverCopy(info.snapshot);
 inspect(root,options);git(root,['cat-file','-e',info.previous+'^{commit}']);
 const target=path.join(path.dirname(root),path.basename(root)+'-recovered-'+unique());
 git(root,['clone','--no-hardlinks',root,target]);git(target,['remote','set-url','origin',git(root,['remote','get-url','origin'])]);git(target,['switch','-c','recovery/preview-'+unique(),info.previous]);return {...inspect(target,options),recovery:true};
}
export function safeSetup(target,{repo=REPO}={}){
 if(existsSync(target)&&readdirSync(target).length)throw Error('目标文件夹非空，已停止，不覆盖现有文件。');mkdirSync(path.dirname(target),{recursive:true});
 execFileSync('git',['clone','--single-branch','--branch',BRANCH,repo,target],{stdio:'pipe'});return target;
}
export function migrationTarget(home=os.homedir()){
 const preferred=path.join(home,'zangdi-preview');if(!existsSync(preferred)||existsSync(path.join(preferred,'.git')))return preferred;
 const alternate=path.join(home,'zangdi-preview-git');if(!existsSync(alternate)||existsSync(path.join(alternate,'.git')))return alternate;
 return path.join(home,'zangdi-preview-git-'+unique());
}
export function safeMigrate(source,target,options={}){
 const p=project(source);if(existsSync(path.join(source,'.git')))return safeUpdate(source,options);
 if(path.relative(path.resolve(source),path.resolve(target))===''||(!path.relative(source,target).startsWith('..')&&!path.isAbsolute(path.relative(source,target))))throw Error('迁移目标必须独立于原ZIP目录，未改变原文件。');
 if(existsSync(target)&&!existsSync(path.join(target,'.git')))throw Error('目标文件夹已存在，不会覆盖。');
 const snapshot=backupProject(source,{version:p.version,kind:'zip'});options.onProgress?.('ZIP完整备份：'+snapshot+'；原文件夹保持不变。');
 if(existsSync(target))return {...safeUpdate(target,options),migrationBackup:snapshot};
 mkdirSync(path.dirname(target),{recursive:true});const staging=mkdtempSync(path.join(path.dirname(target),'.zangdi-migration-'));
 try{
  options.onProgress?.('正在下载并校验指定测试分支，首次迁移可能需要几分钟，请保留此窗口。');safeSetup(staging,options);(options.validateCandidate||verifyCandidate)(staging);const check=inspect(staging,options);if(check.branch!==BRANCH)throw Error('下载分支不匹配。');
  if(existsSync(target))throw Error('目标目录在迁移期间出现，未覆盖。');
  renameSync(staging,target);
  writeFileSync(path.join(target,'.git','zangdi-preview-recovery.json'),JSON.stringify({snapshot,migration:true},null,2));
  return {...inspect(target,options),migrated:true,updated:true,migrationBackup:snapshot};
 }catch(error){if(existsSync(staging))rmSync(staging,{recursive:true,force:true});throw Error('迁移未完成，原ZIP目录与备份均保留：'+snapshot+'\n'+error.message);}
}
// Kept for legacy callers/tests; update no longer treats an unrelated port as a project lock.
export function requireStopped(port=3000){return new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(1500);socket.once('connect',()=>{socket.destroy();reject(Error('预览端口仍在使用。'));});socket.once('error',e=>{socket.destroy();e.code==='ECONNREFUSED'?resolve():reject(e);});socket.once('timeout',()=>{socket.destroy();reject(Error('端口检查超时。'));});});}
function openLocal(value){if(process.platform==='win32')spawn('explorer.exe',[value],{detached:true,stdio:'ignore'}).on('error',()=>{}).unref();}
export function expectedPreviewIdentity(root,env=process.env){
 const p=project(root);let revision;try{revision=readFileSync(path.join(root,'src/version.js'),'utf8').match(/revision\s*:\s*['"]([^'"]+)['"]/)?.[1];}catch{}
 return {version:p.version,source:env.CATALOG_PREVIEW_SOURCE!=='static'&&existsSync(path.join(root,'admin/customer-preview.mjs'))?'merchant':'static',revision};
}
export function reusablePreview(existing,expected){return !!existing&&existing.version===expected.version&&(existing.source||'static')===expected.source&&(!expected.revision||existing.revision===expected.revision);}
export async function startPreview(root,{open=true}={}){
 const p=project(root),expected=expectedPreviewIdentity(root),existing=await managedPreview(root);
 if(reusablePreview(existing,expected)){console.log('预览已经启动：http://localhost:'+existing.port+'；数据来源：'+(expected.source==='merchant'?'本机已保存商品':'静态商品'));if(open)openLocal('http://localhost:'+existing.port);return;}
 if(existing)await stopManagedPreview(root);
 let port;try{port=await availablePort(3000,expected.source==='merchant'?3000:3020,expected.source==='merchant'?'127.0.0.1':'0.0.0.0');}catch(error){if(expected.source==='merchant'&&error.code==='EADDRINUSE')throw Error('3000端口仍由另一个旧网站窗口使用。请关闭旧02黑色窗口，再双击本目录02；未自动改用其他端口，也未终止其他程序。');throw error;}const token=randomUUID();
 console.log('当前版本 v'+p.version+'；本地预览 http://localhost:'+port+'；关闭此预览请按Ctrl+C。');
 if(port!==3000)console.log('3000端口由其他程序使用，已自动选择'+port+'，未停止其他程序。浏览器清单按地址独立保存，原3000端口清单未删除。');
 if(expected.source==='static')for(const list of Object.values(os.networkInterfaces()))for(const a of list||[])if(a.family==='IPv4'&&!a.internal&&(/^(10\.|192\.168\.)/.test(a.address)||/^172\.(1[6-9]|2[0-9]|3[01])\./.test(a.address)))console.log('手机同Wi-Fi访问 http://'+a.address+':'+port);
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['server.js'],{cwd:root,stdio:'inherit',env:{...process.env,PORT:String(port),BASE_PATH:'/',CATALOG_PREVIEW_TOKEN:token,CATALOG_PREVIEW_VERSION:p.version}});
  writeRuntime(root,{token,port,pid:child.pid});
  let probes=0;const ready=setInterval(async()=>{if(await managedPreview(root)){clearInterval(ready);if(open)openLocal('http://localhost:'+port);}else if(++probes>=40)clearInterval(ready);},250);ready.unref();
  child.on('error',error=>{clearInterval(ready);clearRuntime(root,token);reject(error);});child.on('exit',code=>{clearInterval(ready);clearRuntime(root,token);code===0||code===130?resolve():reject(Error('预览启动失败，原文件保留，请检查上方提示。'));});
 });
}
const root=fileURLToPath(new URL('../',import.meta.url));
function chooseFolder(){
 if(process.platform!=='win32')throw Error('图形迁移入口用于Windows；测试调用safeMigrate指定目录。');
 return execFileSync('powershell.exe',['-NoProfile','-STA','-Command',"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='选择原网站文件夹（里面有02-start.cmd和商品照片）'; $d.ShowNewFolderButton=$false; if($d.ShowDialog() -eq 'OK'){[Console]::Write($d.SelectedPath)}"],{encoding:'utf8'}).trim();
}
export async function cli(action){
 if(action==='install'||action==='setup'){
  try{execFileSync('git',['--version'],{stdio:'pipe'});}catch{throw Error('请先安装免费的Git for Windows：https://git-scm.com/downloads/win 。安装后重新双击本入口；无需管理员运行网站。');}
  const source=action==='install'?chooseFolder():root;if(!source){console.log('已取消，原文件未改变。');return;}
  await stopManagedPreview(source);const result=safeMigrate(source,migrationTarget(),{onProgress:console.log});
  console.log('迁移/配置成功！当前版本 v'+result.version+'\n以后只使用固定目录：'+result.root+'\n日常双击03-update.cmd即可更新并自动启动。原ZIP资料未自动合并，已原样保留。');openLocal(result.root);await startPreview(result.root);return;
 }
 if(action==='update'){
  await stopManagedPreview(root);
  const result=existsSync(path.join(root,'.git'))?safeUpdate(root,{onProgress:console.log}):safeMigrate(root,migrationTarget(),{onProgress:console.log});
  console.log((result.migrated?'ZIP迁移成功':result.updated?'更新成功':'已经是最新版')+'！\n当前版本 v'+result.version+'\n提交 '+result.commit+'\n固定目录 '+result.root+'\n现在自动启动网站；日常仍双击03-update.cmd，无需再初始化。');if(result.migrated)openLocal(result.root);await startPreview(result.root);return;
 }
 if(action==='recover'){await stopManagedPreview(root);const result=safeRecover(root);console.log('已恢复到独立目录：'+result.root+'\n当前版本 v'+result.version+'；当前原目录完整保留。');openLocal(result.root);await startPreview(result.root);return;}
 if(action==='resume'){await stopManagedPreview(root);inspect(root);clean(root);git(root,['switch',BRANCH]);console.log('已返回测试分支。下一步双击03更新并启动。');return;}
 if(action==='start'){await startPreview(root);return;}
 console.log(inspect(root));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli(process.argv[2]||'status').catch(e=>{console.error(e.message);console.error('操作未完成；未强制覆盖、未推送、未发布。请保留备份路径及提示。仍可双击02查看当前版本；需要备份副本时双击04恢复。');process.exitCode=1;});
