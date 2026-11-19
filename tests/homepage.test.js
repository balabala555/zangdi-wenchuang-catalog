import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {homeConfig,homeSources,categoryMatches} from '../src/homepage.js';
import {homepagePhotos} from '../src/generated-homepage-images.js';
import {products,categories} from '../src/data.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('homepage has exactly seven approved categories, two only confirmed prices and preserves legacy filtering',()=>{
 assert.equal(homeConfig.categories.length,7);assert.equal(categories.length,8);
 assert.equal(products.find(p=>p.id==='soft-lamb').price,20);assert.equal(products.find(p=>p.id==='rainbow-lamb').price,25);
 for(const id of homeConfig.featuredIds){const p=products.find(p=>p.id===id);assert.equal(p.material,'待门店确认');assert.equal(p.size,'待门店确认');assert.deepEqual(p.variants,['款式待客服确认']);}
 assert.ok(categoryMatches(products.find(p=>p.id==='p04'),'藏地旅行纪念'));assert.ok(categoryMatches(products.find(p=>p.id==='p02'),'织物与穿戴'));
 assert.deepEqual(homeSources['public/images/homepage/jewelry.jpg'].crop,[.77,.16,.23,.56]);
});
test('all homepage sizes are protected compressed derivatives; originals private and privacy panels opaque',async()=>{
 for(const [source,p]of Object.entries(homepagePhotos)){
  assert.equal(p.version,'homepage-vi1.1-private-masks-v1');assert.deepEqual(p.layers,['brand-mark','distributed-protection']);assert.deepEqual(p.crop,homeSources[source].crop);
  const privateFile='.private-originals/'+source.slice('public/images/'.length);
  if(existsSync(privateFile))assert.equal(hash(await readFile(privateFile)),p.sourceSha256);
  for(const [key,max]of [['thumb',240],['card',640],['detail',1600]]){const b=await readFile(p[key].path);assert.equal(hash(b),p[key].sha256);assert.notEqual(hash(b),p.sourceSha256);const meta=await sharp(b).metadata();assert.ok(meta.width<=max && meta.height<=max);assert.ok(!meta.exif);}
  assert.notEqual(hash(await readFile(source)),p.sourceSha256);
  if(p.privacyMasks.length && !p.refinement){
   const detail=p.detail;const {data,info}=await sharp(await readFile(detail.path)).removeAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(p.crop,null);
   const originalSize=existsSync(privateFile)?await sharp(await readFile(privateFile)).metadata():{width:1536,height:1152};
   for(const m of p.privacyMasks){let flat=0,n=0;for(let y=Math.ceil((m.top+m.height*.15)*info.height/originalSize.height);y<Math.floor((m.top+m.height*.85)*info.height/originalSize.height);y++)for(let x=Math.ceil((m.left+m.width*.15)*info.width/originalSize.width);x<Math.floor((m.left+m.width*.85)*info.width/originalSize.width);x++){const i=(y*info.width+x)*3;n++;if(Math.abs(data[i]-200)<18 && Math.abs(data[i+1]-188)<18 && Math.abs(data[i+2]-166)<18)flat++;}assert.ok(flat/n>.60,'Privacy rectangle must be mostly opaque solid panel, not an intact QR or WiFi label');}
  }
 }
});
test('homepage processing twice reuses protected outputs even without private originals',()=>{
 const before=readFileSync('src/generated-homepage-images.js','utf8');const result=execFileSync(process.execPath,['scripts/optimize-homepage.mjs'],{env:{...process.env,CATALOG_ORIGINALS_DIR:'/tmp/no-private-homepage-photos'},encoding:'utf8'});assert.ok(result.includes('9 unchanged entries reused'));assert.equal(readFileSync('src/generated-homepage-images.js','utf8'),before);
});
