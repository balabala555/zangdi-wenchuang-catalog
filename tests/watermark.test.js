import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {optimizedPhotos} from '../src/generated-images.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('watermarks are baked into all sizes; private originals remain untouched',async t=>{
 for(const [source,entry] of Object.entries(optimizedPhotos)){
  const privateFile='.private-originals/'+source.slice('public/images/'.length);
  if(!existsSync(privateFile)){t.skip('Private originals are intentionally absent from GitHub ZIP');return;}
  const original=await readFile(privateFile);assert.equal(hash(original),entry.sourceSha256);
  assert.notEqual(hash(await readFile(source)),entry.sourceSha256);
  for(const [size,max] of [['thumb',240],['card',640]]){
   const base=await sharp(original).rotate().resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).withIccProfile('srgb').png().toBuffer();
   const a=await sharp(base).removeAlpha().raw().toBuffer({resolveWithObject:true});
   const b=await sharp(await readFile(entry[size].path)).removeAlpha().raw().toBuffer();
   assert.equal(a.data.length,b.length);
   let changed=0,central=0;
   for(let i=0;i<b.length;i+=3){
    if(a.data[i]!==b[i] || a.data[i+1]!==b[i+1] || a.data[i+2]!==b[i+2]){
     changed++;const y=Math.floor(i/3/a.info.width);if(y>a.info.height*0.25 && y<a.info.height*0.75)central++;
    }
   }
   const ratio=changed/(a.info.width*a.info.height);
   assert.ok(ratio>0.01 && ratio<0.35,`${size} watermark coverage: ${ratio}`);
   assert.ok(central>100,'Watermarks must be inside the picture, not just corners');
  }
  for(const legacy of entry.legacy){assert.equal(hash(await readFile(legacy.path)),legacy.sha256);assert.notEqual(legacy.sha256,entry.sourceSha256);}
 }
});
test('processing twice does not add another watermark layer, even without private originals',()=>{
 const manifest=readFileSync('src/generated-images.js','utf8');
 const result=execFileSync(process.execPath,['scripts/optimize-images.mjs'],{env:{...process.env,CATALOG_ORIGINALS_DIR:'/tmp/nonexistent-catalog-private-originals'},encoding:'utf8'});
 assert.match(result,/3 unchanged entries reused/);
 assert.equal(readFileSync('src/generated-images.js','utf8'),manifest);
});
test('private upload directory is ignored by Git and never appears in tracked paths',()=>{
 const file='.private-originals/felt-mushroom-bag/light-gray.jpg';
 assert.equal(execFileSync('git',['check-ignore',file],{encoding:'utf8'}).trim(),file);
 assert.equal(execFileSync('git',['ls-files','.private-originals'],{encoding:'utf8'}).trim(),'');
});
test('sharp falls back to the official WASM backend when native DLL/binaries are unavailable',()=>{
 const result=execFileSync(process.execPath,['scripts/check-sharp-fallback.cjs'],{encoding:'utf8',timeout:60000});
 assert.match(result,/PASS official sharp WASM fallback/);
});
