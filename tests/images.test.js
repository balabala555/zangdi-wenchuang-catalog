import test from 'node:test';
import assert from 'node:assert/strict';
import {photoPath,publicPhotos,productGallery,cartPhoto,drawPhoto,loadPhoto} from '../src/images.js';
const common='public/images/p01/common.webp',red='public/images/p01/red.jpg',green='public/images/p01/green.png';
const p={image:null,images:[common,common],variants:['赭红','松绿','暖金'],variantImages:{赭红:[red],松绿:[green]}};
test('gallery keeps variant photos first, appends shared photos and never borrows other variants',()=>{
 assert.deepEqual(productGallery(p,'赭红'),{photos:[red,common],generic:false});
 assert.deepEqual(productGallery(p,'松绿'),{photos:[green,common],generic:false});
 assert.deepEqual(productGallery(p,'暖金'),{photos:[common],generic:true});
 assert.equal(cartPhoto(p,'赭红'),red);assert.equal(cartPhoto(p,'松绿'),green);
 assert.deepEqual(publicPhotos(p),[common]);
});
test('missing variant and missing common photos stay empty even when another variant has photos',()=>{
 const noCommon={...p,images:[]};
 assert.equal(cartPhoto(noCommon,'暖金'),null);
 assert.deepEqual(productGallery(noCommon,'暖金'),{photos:[],generic:false});
 assert.equal(cartPhoto(noCommon,'unknown'),null);
});
test('legacy image and string variants remain supported',()=>{
 const old={image:common,variants:['旧款']};
 assert.deepEqual(publicPhotos(old),[common]);assert.equal(cartPhoto(old,'旧款'),common);
 assert.deepEqual(publicPhotos({image:null}),[]);
});
test('reject unsafe paths and malformed configuration',()=>{
 for(const value of [null,2,'https://other.test/a.jpg','public/images/../a.jpg','public/images/a.svg','public/images/a.jpg"'])assert.equal(photoPath(value),null);
 assert.equal(photoPath('/'+red),red);
 assert.deepEqual(productGallery({images:'bad',variantImages:{x:[null,red]},variants:['x']},'x').photos,[red]);
});
test('PNG photo drawing preserves proportions and centers the actual selected image',()=>{
 const calls=[];const image={naturalWidth:200,naturalHeight:100};
 drawPhoto({drawImage:(...args)=>calls.push(args)},image,50,205,100,120);
 assert.deepEqual(calls,[[image,50,240,100,50]]);
});
test('photo loader completes on success and rejects failed or stalled photos',async()=>{
 const old=globalThis.Image;
 try{
  globalThis.Image=class{set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}};
  assert.equal((await loadPhoto(red)).url,'./'+red);
  globalThis.Image=class{set src(value){queueMicrotask(()=>this.onerror?.());}};
  await assert.rejects(loadPhoto(red),/unavailable/);
  globalThis.Image=class{set src(value){}};
  await assert.rejects(loadPhoto(red,5),/timeout/);
 }finally{globalThis.Image=old;}
});
