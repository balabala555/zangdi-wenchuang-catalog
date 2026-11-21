// One-time free local dependencies. Never runs legacy image generation or touches merchant data.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function ready(){await Promise.all([import('sharp'),import('fontkit'),import('yazl'),import('yauzl')]);const {imageRuntime}=await import('../scripts/doctor-images.mjs');await imageRuntime();}
try{try{await ready();}catch{
 console.log('首次准备免费的本地照片与ZIP组件，可能需要几分钟。只安装此测试项目的依赖，不修改商品库。请保持网络和窗口开启。');
 await new Promise((resolve,reject)=>{const windows=process.platform==='win32',command=windows?'cmd.exe':'npm',args=windows?['/d','/s','/c','npm ci --include=dev --include=optional --no-audit --no-fund']:['ci','--include=dev','--include=optional','--no-audit','--no-fund'];const child=spawn(command,args,{cwd:root,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('免费组件安装未完成。原商品库未修改，请检查网络后重新双击07。')));});await ready();
 }
 const {startAdmin}=await import('./server.mjs');await startAdmin();
}catch(error){console.error(error.message);console.error('未清空商品库、未发布网站。请保留提示并重新启动或联系维护人员。');process.exitCode=1;}
