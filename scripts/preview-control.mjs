import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
export const runtimeFile=root=>path.join(os.tmpdir(),'zangdi-preview-'+createHash('sha256').update(path.resolve(root)).digest('hex')+'.json');
export function writeRuntime(root,state){writeFileSync(runtimeFile(root),JSON.stringify({...state,root:path.resolve(root)}),{mode:0o600});}
export function clearRuntime(root,token){try{const file=runtimeFile(root);if(JSON.parse(readFileSync(file,'utf8')).token===token)unlinkSync(file);}catch{}}
export async function managedPreview(root){
 try{
  const saved=JSON.parse(readFileSync(runtimeFile(root),'utf8'));if(saved.root!==path.resolve(root)||!Number.isInteger(saved.port)||!saved.token)return null;
  const response=await fetch(`http://127.0.0.1:${saved.port}/.catalog-control`,{headers:{'X-Catalog-Token':saved.token},signal:AbortSignal.timeout(1500)});
  if(!response.ok){await response.arrayBuffer();return null;}const identity=await response.json();
  return identity.root===saved.root?{...saved,...identity}:null;
 }catch{return null;}
}
function listening(port){return new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.setTimeout(500);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>{socket.destroy();resolve(false);});socket.once('timeout',()=>{socket.destroy();resolve(true);});});}
export async function stopManagedPreview(root){
 const saved=await managedPreview(root);if(!saved)return {stopped:false};
 let response;
 try{response=await fetch(`http://127.0.0.1:${saved.port}/.catalog-control/stop`,{method:'POST',headers:{'X-Catalog-Token':saved.token},signal:AbortSignal.timeout(3000)});}
 catch(error){if(error.cause?.code==='ECONNREFUSED'){clearRuntime(root,saved.token);return {stopped:true,port:saved.port};}throw Error('关闭预览连接失败，未更新文件：'+error.message);}
 if(!response.ok)throw Error('无法安全关闭本目录的受管理预览，未更新文件。');
 for(let i=0;i<30;i++){if(!(await managedPreview(root))&&!(await listening(saved.port))){clearRuntime(root,saved.token);return {stopped:true,port:saved.port};}await new Promise(r=>setTimeout(r,100));}
 throw Error('受管理预览尚未关闭，请稍后双击更新；未修改项目。');
}
export function availablePort(start=3000,limit=start+20){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',e=>{if(e.code==='EADDRINUSE'&&start<limit)availablePort(start+1,limit).then(resolve,reject);else reject(e);});server.listen(start,'0.0.0.0',()=>server.close(()=>resolve(start)));});}
