// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-mobile-saving.mjs
import assert from 'node:assert/strict';
import {photoUrl} from '../src/images.js';
import {createServer} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 for(const standalone of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:667},hasTouch:true});
  const downloads=[];page.on('download',d=>downloads.push(d));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('shan-cart',JSON.stringify(['浅灰色','浅薄荷绿','亮蓝色'].map(variant=>({id:'felt-mushroom-bag',variant,quantity:1}))));
   window.shared=[];Object.defineProperty(navigator,'canShare',{value:({files})=>files[0].type==='image/png'});
   Object.defineProperty(navigator,'share',{value:async ({files})=>{window.shared.push({name:files[0].name,type:files[0].type,size:files[0].size});if(window.rejectShare)throw new DOMException('cancel','AbortError');}});
  });
  if(standalone)await page.route('**/public/images/**',route=>route.abort());
  await page.goto(origin+(standalone?'/preview.html':'/'));
  await page.locator('[data-product="felt-mushroom-bag"]').click();
  const action=await page.locator('#add-cart').boundingBox();assert.ok(action.y>=0 && action.y+action.height<=667);
  await page.locator('#detail .detail-layout').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  assert.ok(await page.locator('#detail .detail-layout').evaluate(el=>el.scrollTop>0));
  await page.locator('[data-variant="亮蓝色"]').click();
  assert.equal(await page.locator('#detail .quantity span').textContent(),'1');
  await page.locator('#detail [data-close]').click();
  await page.locator('#open-list').click();
  for(const img of await page.locator('.list-item img').all()){
   await img.evaluate(el=>el.decode());const box=await img.boundingBox();assert.ok(box.width>=60 && box.height>=80);
   assert.equal(await img.getAttribute('loading'),'eager');
  }
  await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
  await page.locator('#export-preview').evaluate(el=>el.decode());
  const size=await page.locator('#export-preview').evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight}));assert.equal(size.width,900);assert.ok(size.height>800);
  if(!await page.evaluate(()=>window.shared.length))await page.locator('#share-image').click();
  assert.ok(await page.evaluate(()=>window.shared[0].size>10000 && window.shared[0].type==='image/png'));
  await page.evaluate(()=>window.rejectShare=true);await page.locator('#share-image').click();
  assert.equal(await page.locator('#export-preview').count(),1);assert.equal(await page.locator('#share-image').isEnabled(),true);
  assert.equal(downloads.length,0,'No automatic download during generation, sharing, or cancellation');
  const dl=page.waitForEvent('download');await page.locator('#download-image').click();assert.equal(await (await dl).failure(),null);
  // A changed cart must remove the stale exported image.
  await page.locator('[data-change="1"]').first().click();assert.equal(await page.locator('#export-preview').count(),0);
  assert.deepEqual(errors,[]);await page.close();
  console.log('PASS '+(standalone?'embedded standalone':'HTTP')+': scroll, visible action bar, eager real thumbnails, PNG, native-share mock, cancellation, download, stale-image cleanup');
 }
 const page=await browser.newPage({viewport:{width:390,height:667}});
 await page.addInitScript(()=>localStorage.setItem('shan-cart',JSON.stringify([{id:'felt-mushroom-bag',variant:'亮蓝色',quantity:1}])));
 await page.route('**/'+photoUrl('public/images/felt-mushroom-bag/bright-blue.jpg','thumb').slice(2),route=>route.fulfill({status:404,body:'missing'}));
 await page.route('**/public/images/felt-mushroom-bag/bright-blue.jpg',route=>route.fulfill({status:404,body:'missing'}));
 await page.goto(origin);await page.locator('#open-list').click();await page.locator('#export-image').click();
 await page.getByText('羊毛毡立体蘑菇手提包（亮蓝色）照片加载失败，请检查网络后重试',{exact:true}).waitFor();
 assert.equal(await page.locator('#export-preview').count(),0);
 assert.equal(await page.locator('#export-image').isEnabled(),true);
 console.log('PASS missing real photo: export blocked with exact variant error rather than a silently incomplete PNG');
 await page.unroute('**/public/images/felt-mushroom-bag/bright-blue.jpg');
 await page.unroute('**/'+photoUrl('public/images/felt-mushroom-bag/bright-blue.jpg','thumb').slice(2));
 let automaticDownloads=0;page.on('download',()=>automaticDownloads++);
 await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
 assert.equal(automaticDownloads,0);assert.equal(await page.locator('#share-image').count(),0);
 assert.match(await page.locator('.save-image-hint').textContent(),/长按下方图片/);
 console.log('PASS no native share: no automatic download; prominent long-press image remains available');
 await page.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
