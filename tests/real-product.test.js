import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {products,categories} from '../src/data.js';
import {productGallery,cartPhoto} from '../src/images.js';
import {sanitizeCart,total,listText} from '../src/cart.js';
test('real felt bag is one product, preserves original catalog and has isolated original photos',async()=>{
 assert.equal(products.filter(p=>p.id==='felt-mushroom-bag').length,1);
 assert.ok(['p01','p02','p03','p04','p05','p06'].every(id=>products.some(p=>p.id===id)));
 const p=products.find(p=>p.id==='felt-mushroom-bag');
 assert.equal(p.price,90);assert.equal(p.material,'羊毛毡');assert.ok(categories.includes(p.category));
 const files=['light-gray.jpg','light-mint.jpg','bright-blue.jpg'];
 const hashes=[];
 for(const [i,variant] of p.variants.entries()){
  const photo=`public/images/felt-mushroom-bag/${files[i]}`;
  assert.deepEqual(productGallery(p,variant).photos,[photo]);assert.equal(cartPhoto(p,variant),photo);
  const bytes=await readFile(new URL('../'+photo,import.meta.url));
  assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');
  hashes.push(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(new Set(hashes).size,3);
 const cart=sanitizeCart(p.variants.map(variant=>({id:p.id,variant,quantity:1})));
 assert.equal(cart.length,3);assert.equal(total(cart),270);
 for(const variant of p.variants)assert.ok(listText(cart).includes(variant));
 assert.deepEqual(productGallery({...p,variantImages:{...p.variantImages,'浅薄荷绿':[]}},'浅薄荷绿').photos,[]);
});
