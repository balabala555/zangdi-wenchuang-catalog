// Fixed-directory preview/update helper. No npm install, image processing, force-reset, push or deployment.
import {execFileSync,spawn} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
export const REPO='https://github.com/balabala555/zangdi-wenchuang-catalog.git',BRANCH='test/vi-v1.3.0';
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
export function inspect(root,{repo=REPO}={}){
 const p=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));if(p.name!=='zangdi-wenchuang-catalog')throw Error('不是指定的网站项目，已停止。');
 const top=git(root,['rev-parse','--show-toplevel']);if(path.relative(path.resolve(top),path.resolve(root))!=='')throw Error('请在项目根目录操作。');
 if(git(root,['remote','get-url','origin']).replace(/\.git$/,'')!==repo.replace(/\.git$/,''))throw Error('远程仓库不匹配，已停止。');
 return {version:p.version,branch:git(root,['branch','--show-current']),commit:git(root,['rev-parse','HEAD'])};
}
function clean(root){if(git(root,['status','--porcelain','--untracked-files=normal']))throw Error('有本地修改或未跟踪文件。不会覆盖，请保留并检查后再更新。');}
export function safeUpdate(root,options={}){
 const before=inspect(root,options);clean(root);if(before.branch!==BRANCH)throw Error('当前不在V1.3.0测试分支；不会自动切换或覆盖恢复分支。');
 git(root,['fetch','origin',`refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
 const next=git(root,['rev-parse',`refs/remotes/origin/${BRANCH}`]);
 try{git(root,['merge-base','--is-ancestor',before.commit,next]);}catch{throw Error('本地与远程存在分叉，已停止，不会强制覆盖。');}
 if(next===before.commit)return {...before,updated:false};
 const backup='backup/preview-'+stamp();git(root,['branch',backup,before.commit]);
 const meta=git(root,['rev-parse','--git-path','zangdi-preview-recovery.json']);const file=path.resolve(root,meta);
 writeFileSync(file,JSON.stringify({previous:before.commit,updated:next,backup},null,2));
 git(root,['merge','--ff-only',next]);return {...inspect(root,options),updated:true,backup};
}
export function safeRecover(root,options={}){
 inspect(root,options);clean(root);const file=path.resolve(root,git(root,['rev-parse','--git-path','zangdi-preview-recovery.json']));
 if(!existsSync(file))throw Error('尚无本工具的更新恢复点，未修改任何文件。');const info=JSON.parse(readFileSync(file,'utf8'));git(root,['cat-file','-e',info.previous+'^{commit}']);
 const branch='recovery/preview-'+stamp();git(root,['switch','-c',branch,info.previous]);return {...inspect(root,options),recovery:true};
}
export function safeSetup(target,{repo=REPO}={}){
 if(existsSync(target)&&readdirSync(target).length)throw Error('目标文件夹非空，已停止，不覆盖现有文件。');mkdirSync(path.dirname(target),{recursive:true});
 execFileSync('git',['clone','--single-branch','--branch',BRANCH,repo,target],{stdio:'inherit'});return target;
}
export function requireStopped(port=3000){return new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(1500);socket.once('connect',()=>{socket.destroy();reject(Error('预览端口仍在使用。请先到原服务器窗口按Ctrl+C，再执行更新或恢复。'));});socket.once('error',e=>{socket.destroy();e.code==='ECONNREFUSED'?resolve():reject(Error('无法确认预览是否已关闭，已停止。'));});socket.once('timeout',()=>{socket.destroy();reject(Error('检查预览端口超时，已停止。'));});});}
const root=fileURLToPath(new URL('../',import.meta.url));
export async function cli(action){
 if(['update','recover','resume'].includes(action))await requireStopped();
 if(action==='setup'){const target=path.join(os.homedir(),'zangdi-preview');console.log('固定测试目录：'+target);safeSetup(target);console.log('配置完成。以后只使用此目录中的02-start.cmd和03-update.cmd。');return;}
 if(action==='update'){console.log('请先在原服务器窗口按Ctrl+C关闭预览。');console.log(safeUpdate(root));return;}
 if(action==='recover'){console.log(safeRecover(root));console.log('已在独立恢复分支打开上一版；原测试分支保留。');return;}
 if(action==='resume'){inspect(root);clean(root);git(root,['switch',BRANCH]);console.log('已回到V1.3.0测试分支。');return;}
 if(action==='start'){
  await requireStopped(3000);
  const p=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));console.log('扎西德勒鸭·藏地选物 测试版 v'+p.version+'；仅本地预览');
  console.log('电脑打开 http://localhost:3000；关闭请按Ctrl+C。若端口被占用请关闭旧预览，不要反复启动。');
  for(const list of Object.values(os.networkInterfaces()))for(const a of list||[])if(a.family==='IPv4'&&!a.internal && (/^(10\.|192\.168\.)/.test(a.address)||/^172\.(1[6-9]|2[0-9]|3[01])\./.test(a.address)))console.log('手机同一Wi-Fi可访问 http://'+a.address+':3000（需Windows防火墙允许，原生分享通常需要HTTPS）');
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['server.js'],{cwd:root,stdio:'inherit',env:{...process.env,PORT:'3000',BASE_PATH:'/'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('预览已停止或启动失败，请检查上方提示。')));});return;
 }
 console.log(inspect(root));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli(process.argv[2]||'status').catch(e=>{console.error(e.message);console.error('未执行强制覆盖、推送或发布。Git未安装时请先安装免费的Git for Windows。');process.exitCode=1;});
