// Local-only structured diagnostics: never persist request bodies, tokens, paths or photo names.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {releaseInfo} from '../src/version.js';
export const stages={
 'photo-baseline':'上传前资料保护','photo-receive':'接收照片文件','photo-read':'读取上传文件','photo-library':'核对已有照片','photo-tools':'加载图片与字体组件','photo-inspect':'识别照片格式','photo-original':'保存私有原图','photo-resize':'调整展示尺寸与色彩配置','photo-watermark':'生成品牌水印','photo-webp':'保存WebP展示图','photo-jpeg':'保存JPEG展示图','photo-metadata':'保存照片关联资料','photo-sync':'刷新照片文件写入','photo-cleanup':'清理本次上传的临时文件','photo-finalize':'完成照片归档','product-validate':'校验商品照片关联','product-snapshot':'保存商品资料快照','request':'处理管理请求'
};
export function atStage(error,stage){if(!(error instanceof Error))error=Error('Operation failed');if(!error.adminStage)error.adminStage=stage;return error;}
export function recordFailure(dataDir,error,stage='request'){
 const id='UP-'+randomUUID(),cause=error.cause||error,code=/^[A-Z][A-Z0-9_]{0,31}$/.test(cause.code||'')?cause.code:'UNKNOWN',step=Object.hasOwn(stages,error.adminStage)?error.adminStage:Object.hasOwn(stages,stage)?stage:'request';
 const frames=[...String(cause.stack||'').split('\n').slice(1).join('\n').matchAll(/([a-zA-Z0-9_.-]+\.(?:mjs|cjs|js)):(\d+):(\d+)/g)].slice(0,6).map(m=>`${m[1]}:${m[2]}:${m[3]}`);
 const entry={id,time:new Date().toISOString(),stage:step,code,syscall:['open','mkdir','read','write','fsync','rename','close','unlink'].includes(cause.syscall)?cause.syscall:undefined,frames,runtime:{platform:process.platform,arch:process.arch,node:process.versions.node,revision:releaseInfo.revision}};
 let saved=false;try{const dir=path.join(dataDir,'diagnostics');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'errors.jsonl');if(fs.existsSync(file)&&fs.statSync(file).size>2*1024*1024)fs.renameSync(file,path.join(dir,'errors-'+randomUUID()+'.jsonl'));fs.appendFileSync(file,JSON.stringify(entry)+'\n',{mode:0o600});saved=true;}catch{/* Report safely even if the data disk cannot accept a diagnostic log. */}
 console.error('[本地管理错误] '+JSON.stringify({...entry,logSaved:saved}));
 return {id,stage:step,code,logSaved:saved,message:`${stages[step]}未完成（${code}）。错误编号：${id}。${saved?'诊断已保存在私有商品库的 diagnostics/errors.jsonl。':'日志文件未能写入，请保留黑色窗口中的同编号记录。'}已有商品资料和已归档照片未因此删除。`};
}
