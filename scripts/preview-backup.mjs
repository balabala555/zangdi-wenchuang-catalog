import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const unique=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
export function backupProject(root,details={}){
 const dir=path.join(path.dirname(root),path.basename(root)+'-backups',unique());mkdirSync(dir,{recursive:true});
 // Preserve source files, personal files and ignored originals. Only rebuildable dependencies
 // and Git internals are excluded; Git history is saved separately as a private bundle.
 cpSync(root,path.join(dir,'files'),{recursive:true,filter:file=>!['.git','node_modules'].includes(path.relative(root,file).split(path.sep)[0])});
 if(existsSync(path.join(root,'.git')))execFileSync('git',['bundle','create',path.join(dir,'repository.bundle'),'--all'],{cwd:root,stdio:'pipe'});
 writeFileSync(path.join(dir,'backup.json'),JSON.stringify({root,createdAt:new Date().toISOString(),...details},null,2));return dir;
}
export function recoverCopy(snapshot){
 const info=JSON.parse(readFileSync(path.join(snapshot,'backup.json'),'utf8'));
 const target=path.join(path.dirname(info.root),path.basename(info.root)+'-recovered-'+unique());
 if(existsSync(path.join(snapshot,'repository.bundle'))){
  execFileSync('git',['clone',path.join(snapshot,'repository.bundle'),target],{stdio:'pipe'});
  execFileSync('git',['switch','-c','recovery/preview-'+unique(),info.commit],{cwd:target,stdio:'pipe'});
 }
 cpSync(path.join(snapshot,'files'),target,{recursive:true});
 return {root:target,version:info.version,commit:info.commit||null,backup:snapshot,recovery:true};
}
