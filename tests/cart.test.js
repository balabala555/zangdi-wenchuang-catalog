import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeCart,total,listText} from '../src/cart.js';
import {products} from '../src/data.js';
test('stored cart rejects obsolete products, invalid variants and quantities',()=>{
  assert.deepEqual(sanitizeCart([null,{id:'missing',variant:'赭红',quantity:1},{id:'p01',variant:'错误',quantity:1},{id:'p01',variant:'赭红',quantity:-1},{id:'p01',variant:'赭红',quantity:1.5}]),[]);
  assert.deepEqual(sanitizeCart({}),[]);
});
test('same product and variant merge, variants remain distinct and quantity is capped',()=>{
  assert.deepEqual(sanitizeCart([{id:'p01',variant:'赭红',quantity:80},{id:'p01',variant:'赭红',quantity:40},{id:'p01',variant:'松绿',quantity:2}]),[{id:'p01',variant:'赭红',quantity:99},{id:'p01',variant:'松绿',quantity:2}]);
});
test('total and share text include correct variants, quantities and demo notice',()=>{
  const cart=[{id:'p01',variant:'赭红',quantity:2},{id:'p03',variant:'砂白',quantity:1}];
  assert.equal(total(cart),232);assert.match(listText(cart),/赭红 × 2/);assert.match(listText(cart),/参考合计：¥232/);assert.match(listText(cart),/非订单/);assert.equal(total([]),0);
});
test('demo catalog has unique identities, valid prices and selectable variants',()=>{
  assert.equal(new Set(products.map(p=>p.id)).size,products.length);
  for(const p of products){assert.ok(p.price>0);assert.ok(p.variants.length>0);assert.ok(p.image===null || /^public\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(p.image));}
});
