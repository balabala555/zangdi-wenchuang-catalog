import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {brandConfig} from '../src/brand.js';
import {optimizedPhotos} from '../src/generated-images.js';
import {createServer} from '../server.js';

for(const basePath of ['/', '/catalog'])test(`preview resources work under ${basePath}`,async()=>{
  const server=createServer({basePath});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const base=origin+(basePath==='/'?'':basePath)+'/';
  try{
    const home=await fetch(base);assert.equal(home.status,200);
    const html=await home.text();assert.match(html,/把喜欢的藏地/);assert.match(html,/id="home-category-grid"/);
    for(const [resource,type] of [['./src/style.css','text/css'],['./src/app.js','text/javascript'],['./src/data.js','text/javascript'],['./src/cart.js','text/javascript'],['./src/images.js','text/javascript']]){
      const res=await fetch(new URL(resource,base));assert.equal(res.status,200);assert.ok(res.headers.get('content-type').startsWith(type));
    }
    const preview=await fetch(new URL('preview.html',base));assert.equal(preview.status,200);
    const standalone=await preview.text();assert.match(standalone,/<style>/);assert.match(standalone,/<script>/);assert.doesNotMatch(standalone,/<script[^>]+src=|<link[^>]+stylesheet|^import /m);
    assert.match(standalone,/id="download-page"/);
    const download=await fetch(new URL('download.html',base));assert.equal(download.status,200);
    assert.equal(download.headers.get('content-disposition'),'attachment; filename="zangdi-catalog.html"');
    assert.ok(download.headers.get('content-type').startsWith('text/html'));
    const exported=await download.text();assert.match(exported,/<style>/);assert.match(exported,/<script>/);
    new Script(exported.match(/<script>([\s\S]*?)<\/script>/)[1]);
    const qrs=JSON.parse(exported.match(/const embeddedBrandQrs=(.*);\n/)[1]);
    for(const service of brandConfig.customerServices){
      assert.ok(qrs[service.qrCodePath].startsWith('data:image/jpeg;base64,'));
      assert.deepEqual(Buffer.from(qrs[service.qrCodePath].split(',')[1],'base64'),await readFile(new URL('../'+service.qrCodePath,import.meta.url)));
    }
    const embedded=JSON.parse(exported.match(/const embeddedPhotos=(.*);\n/)[1]);
    for(const name of ['light-gray.jpg','light-mint.jpg','bright-blue.jpg']){
      const photo='public/images/felt-mushroom-bag/'+name;
      assert.ok(embedded[photo].startsWith('data:image/jpeg;base64,'));
      assert.deepEqual(Buffer.from(embedded[photo].split(',')[1],'base64'),await readFile(new URL('../'+photo,import.meta.url)));
    }

    assert.doesNotMatch(exported,/<script[^>]+src=|<link[^>]+stylesheet|^import |id="download-page"/m);
    const rendition=Object.values(optimizedPhotos)[0].thumb.path;
    const optimized=await fetch(new URL(rendition,base));assert.equal(optimized.status,200);
    assert.equal(optimized.headers.get('cache-control'),'public, max-age=31536000, immutable');
    const cached=await fetch(new URL(rendition,base),{headers:{'If-None-Match':optimized.headers.get('etag')}});
    assert.equal(cached.status,304);assert.equal(await cached.text(),'');
    const original=await fetch(new URL(Object.keys(optimizedPhotos)[0],base));
    assert.equal(original.headers.get('cache-control'),'public, max-age=0, must-revalidate');
    for(const service of brandConfig.customerServices){
      const response=await fetch(new URL(service.qrCodePath,base));assert.equal(response.status,200);
      assert.ok(response.headers.get('content-type').startsWith('image/jpeg'));
      assert.equal(response.headers.get('cache-control'),'public, max-age=0, must-revalidate');
      const cached=await fetch(new URL(service.qrCodePath,base),{headers:{'If-None-Match':response.headers.get('etag')}});assert.equal(cached.status,304);
    }
    const missing=await fetch(new URL('public/images/missing.jpg',base));assert.equal(missing.status,404);assert.doesNotMatch(await missing.text(),/<!doctype/i);
    assert.equal((await fetch(new URL('.git/config',base))).status,404);
    assert.equal((await fetch(new URL('.private-originals/felt-mushroom-bag/light-gray.jpg',base))).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
    if(basePath!=='/')assert.equal((await fetch(origin+basePath,{redirect:'manual'})).headers.get('location'),basePath+'/');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
