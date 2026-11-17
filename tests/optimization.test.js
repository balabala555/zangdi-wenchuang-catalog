import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {brandConfig} from '../src/brand.js';
import {optimizedPhotos} from '../src/generated-images.js';
import {photoUrl,photoSrcset} from '../src/images.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('watermarked renditions match manifests, are bounded and match correct public variants',async()=>{
 let originalTotal=0,thumbTotal=0,cardTotal=0;
 for(const [source,entry] of Object.entries(optimizedPhotos)){
  const recipe=JSON.parse(entry.recipe);
  assert.equal(recipe.brand.name,brandConfig.name);assert.equal(recipe.brand.englishName,brandConfig.englishName);assert.equal(recipe.brand.subtitle,brandConfig.subtitle);
  assert.deepEqual(recipe.brand.contacts,brandConfig.customerServices.map(service=>service.wechatId));
  const original=await readFile(new URL('../'+source,import.meta.url));originalTotal+=original.length;
  for(const [size,max] of [['thumb',240],['card',640],['detail',1600]]){
   const bytes=await readFile(new URL('../'+entry[size].path,import.meta.url));
   assert.equal(hash(bytes),entry[size].sha256);assert.equal(bytes.length,entry[size].bytes);
   const metadata=await sharp(bytes).metadata();assert.ok(metadata.width<=max && metadata.height<=max);
   assert.deepEqual(entry[size].layers,['brand-mark','distributed-protection','brand-signature']);
   assert.equal(entry[size].height,entry[size].photoHeight+entry[size].footerHeight);
   assert.equal(entry[size].width,entry[size].photoWidth);
   if(size!=='detail')assert.equal(metadata.isProgressive,false);
   assert.equal(entry.watermarkVersion,'merchant-three-layer-v4');
  }
  // The compatibility fallback and current detail rendition carry the same watermark.
  const detail=await readFile(new URL('../'+entry.detail.path,import.meta.url));
  const raw=await sharp(original).rotate().toColourspace('srgb').raw().toBuffer();
  const metadata=await sharp(original).metadata();
  if(Math.max(metadata.width,metadata.height)<=1600)assert.deepEqual(await sharp(detail).rotate().toColourspace('srgb').raw().toBuffer(),raw);
  thumbTotal+=entry.thumb.bytes;cardTotal+=entry.card.bytes;
  assert.equal(photoUrl(source,'thumb'),'./'+entry.thumb.path);assert.match(photoSrcset(source),/w,/);
 }
 assert.ok(thumbTotal<originalTotal*0.1);assert.ok(cardTotal<originalTotal*0.5);
});
test('unchanged compression runs reuse checksummed renditions and produce identical manifests',()=>{
 const manifest=readFileSync(new URL('../src/generated-images.js',import.meta.url),'utf8');
 const before=execFileSync(process.execPath,['scripts/optimize-images.mjs'],{encoding:'utf8'});
 assert.ok(before.includes(`${Object.keys(optimizedPhotos).length} unchanged entries reused`));
 assert.equal(readFileSync(new URL('../src/generated-images.js',import.meta.url),'utf8'),manifest);
});
