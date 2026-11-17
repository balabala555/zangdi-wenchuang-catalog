// Read-only audit: reports exposure; never deletes files, resets branches or rewrites history.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {optimizedPhotos} from '../src/generated-images.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const knownOriginals=new Set(Object.values(optimizedPhotos).map(p=>p.sourceSha256));
const files=git('ls-files','--cached','--others','--exclude-standard','-z','public/images','dist').split('\0').filter(Boolean);
let exposed=0,checked=0;
for(const file of files){
 const bytes=await readFile(file);checked++;
 const inline=file.endsWith('.html') && [...bytes.toString().matchAll(/data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)/g)].some(match=>knownOriginals.has(hash(Buffer.from(match[1],'base64'))));
 if(knownOriginals.has(hash(bytes)) || inline){console.log('UNWATERMARKED current file: '+file);exposed++;}
}
const objects=git('rev-list','--objects','--all').split('\n');
const history=[];
for(const line of objects){
 const [oid,...parts]=line.split(' '),name=parts.join(' ');
 if(!/^public\/images\//.test(name) || !/\.(jpg|jpeg|webp|png)$/.test(name))continue;
 const bytes=execFileSync('git',['cat-file','blob',oid],{maxBuffer:32*1024*1024});
 if(knownOriginals.has(hash(bytes)))history.push({object:oid,path:name});
}
const htmlCommits=git('log','--all','--format=%H','--','dist/index.html').split('\n').filter(Boolean);
const embeds=[];
for(const commit of htmlCommits){
 let html;try{html=git('show',commit+':dist/index.html');}catch{continue;}
 for(const match of html.matchAll(/data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)/g)){
  if(knownOriginals.has(hash(Buffer.from(match[1],'base64')))){embeds.push(commit);break;}
 }
}
console.log(JSON.stringify({checkedCurrentFiles:checked,currentUnwatermarkedMatches:exposed,historyOriginalObjects:history,historyHtmlWithOriginals:embeds},null,2));
if(exposed)process.exitCode=1;
