import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.js';

for(const basePath of ['/', '/catalog'])test(`preview resources work under ${basePath}`,async()=>{
  const server=createServer({basePath});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const base=origin+(basePath==='/'?'':basePath)+'/';
  try{
    const home=await fetch(base);assert.equal(home.status,200);
    const html=await home.text();assert.match(html,/商品图片待上传/);
    for(const [resource,type] of [['./src/style.css','text/css'],['./src/app.js','text/javascript'],['./src/data.js','text/javascript'],['./src/cart.js','text/javascript']]){
      const res=await fetch(new URL(resource,base));assert.equal(res.status,200);assert.ok(res.headers.get('content-type').startsWith(type));
    }
    const preview=await fetch(new URL('preview.html',base));assert.equal(preview.status,200);
    const standalone=await preview.text();assert.match(standalone,/<style>/);assert.match(standalone,/<script>/);assert.doesNotMatch(standalone,/<script[^>]+src=|<link[^>]+stylesheet|^import /m);
    assert.match(standalone,/id="download-page"/);
    const download=await fetch(new URL('download.html',base));assert.equal(download.status,200);
    assert.equal(download.headers.get('content-disposition'),'attachment; filename="zangdi-catalog.html"');
    assert.ok(download.headers.get('content-type').startsWith('text/html'));
    const exported=await download.text();assert.match(exported,/<style>/);assert.match(exported,/<script>/);
    assert.doesNotMatch(exported,/<script[^>]+src=|<link[^>]+stylesheet|^import |id="download-page"/m);
    const missing=await fetch(new URL('public/images/missing.jpg',base));assert.equal(missing.status,404);assert.doesNotMatch(await missing.text(),/<!doctype/i);
    assert.equal((await fetch(new URL('.git/config',base))).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
    if(basePath!=='/')assert.equal((await fetch(origin+basePath,{redirect:'manual'})).headers.get('location'),basePath+'/');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
