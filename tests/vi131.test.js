import {homepagePhotos} from '../src/generated-homepage-images.js';
import {homeSources} from '../src/homepage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cartPhoto} from '../src/images.js';
import {products} from '../src/data.js';
import {total,sanitizeCart} from '../src/cart.js';
import {siteConfig} from '../src/site.js';
import {exportLayout} from '../src/export.js';
test('cart photo prioritizes own style, then explicit main photo, never another style',()=>{
 const p={variants:['a','b'],variantImages:{a:['public/images/a.jpg']},coverImage:'public/images/main.jpg',images:['public/images/extra.jpg']};
 assert.equal(cartPhoto(p,'a'),'public/images/a.jpg');assert.equal(cartPhoto(p,'b'),'public/images/main.jpg');assert.equal(cartPhoto(p,''),'public/images/main.jpg');assert.equal(cartPhoto({...p,coverImage:null,images:[]},'b'),null);
});
test('confirmed seven-piece regression totals 290 without data changes',()=>{
 const rows=[['felt-mushroom-bag',2],['soft-lamb',3],['rainbow-lamb',2]].map(([id,quantity])=>({id,variant:products.find(p=>p.id===id).variants[0],quantity}));
 assert.equal(total(sanitizeCart(rows)),290);assert.equal(rows.reduce((s,r)=>s+r.quantity,0),7);
 for(const row of rows)assert.ok(cartPhoto(products.find(p=>p.id===row.id),row.variant));
 assert.equal(siteConfig.customerMode,'equal');assert.equal(siteConfig.exportWatermark.angle,-25);assert.ok(exportLayout.photoWidth>105);assert.ok(exportLayout.photoHeight>120);
});

test('mall original gets its own compressed protected horizontal crop with the full duck sign',()=>{
 const path=siteConfig.stores[0].photo,p=homepagePhotos[path],crop=homeSources[path].crop;
 assert.equal(path,'public/images/stores/barkhor-mall.jpg');assert.equal(p.sourceSha256,'314386bed14fa416ecba8c7847ffe3c75f79deb26adce46a0e56c212f51b42bf');
 assert.deepEqual(p.layers,['brand-mark','distributed-protection']);assert.equal(crop[0],0);assert.equal(crop[2],1);
 assert.ok(crop[1]*1447<=310 && (crop[1]+crop[3])*1447>=675,'Full green sign and duck retained');
 assert.ok(Math.abs(p.card.width/p.card.height-1.94)<.02);assert.ok(p.card.bytes<150000);assert.ok(p.detail.bytes<500000);
});
