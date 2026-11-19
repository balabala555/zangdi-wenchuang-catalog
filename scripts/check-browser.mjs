// Optional browser regression: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-browser.mjs
// Test-only image responses and data overrides never change catalog files or become product photos.
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('shan-cart',JSON.stringify([{id:'p01',variant:'赭红',quantity:2}]));
  window.drawnPhotos=[];
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...args){window.drawnPhotos.push(img.src);return draw.call(this,img,...args);};
 });
 await page.route('**/src/data.js',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:(await response.text())+`\nproducts[0].images=['public/images/test/common.png'];products[0].variantImages={'赭红':['public/images/test/red.png','public/images/test/red-detail.png'],'松绿':['public/images/test/green.png']};`});
 });
 // A transparent pixel is only an HTTP fixture; no fake product artwork is stored.
 await page.route('**/public/images/test/*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=','base64')}));
 await page.goto(origin);
 await page.locator('[data-product="p01"]').click();
 const main=()=>page.locator('.gallery-stage img');
 assert.match(await main().getAttribute('src'),/red.png$/);
 assert.equal(await page.locator('[data-photo]').count(),3);
 await page.locator('[data-delta="1"]').click();
 await page.locator('[data-photo="1"]').click();assert.match(await main().getAttribute('src'),/red-detail.png$/);
 await page.locator('.gallery-stage').evaluate(el=>{
  el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:1,target:el,clientX:250,clientY:100})]}));
  el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[new Touch({identifier:1,target:el,clientX:80,clientY:105})]}));
 });
 assert.match(await main().getAttribute('src'),/common.png$/);
 await page.locator('[data-variant="松绿"]').click();assert.match(await main().getAttribute('src'),/green.png$/);
 assert.equal(await page.locator('#detail .quantity span').textContent(),'2');
 await page.locator('#add-cart').click();
 await page.locator('#open-list').click();
 assert.equal(await page.locator('.list-item').count(),2);
 assert.match(await page.locator('.list-item').nth(0).locator('img').getAttribute('src'),/red.png$/);
 assert.match(await page.locator('.list-item').nth(1).locator('img').getAttribute('src'),/green.png$/);
 assert.match(await page.locator('.list-total').textContent(),/272/);
 await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
 const downloadPromise=page.waitForEvent('download');await page.locator('#download-image').click();
 const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.png$/);assert.equal(await download.failure(),null);
 const drawn=await page.evaluate(()=>window.drawnPhotos);assert.ok(drawn.some(p=>p.endsWith('/red.png')));assert.ok(drawn.some(p=>p.endsWith('/green.png')));
 await page.locator('#list-dialog [data-close]').click();
 await page.locator('[data-product="p01"]').click();await page.locator('[data-variant="暖金"]').click();
 assert.match(await main().getAttribute('src'),/common.png$/);assert.match(await page.locator('.gallery-caption').textContent(),/通用展示图/);
 await page.route('**/public/images/test/missing.png',route=>route.fulfill({status:404,body:'Not found'}));
 await page.evaluate(async()=>{const {products}=await import('/src/data.js');products[0].variantImages['松绿']=['public/images/test/missing.png'];});
 await page.locator('[data-variant="松绿"]').click();
 await page.locator('.gallery-stage .image-failed').waitFor();
 assert.equal(await main().isVisible(),false);
 assert.match(await page.locator('.gallery-stage').textContent(),/图片待上传/);
 await page.locator('#detail [data-close]').click();await page.locator('[data-product="p02"]').click();
 assert.equal(await main().count(),0);assert.match(await page.locator('.gallery-caption').textContent(),/图片待上传/);
 await page.locator('#detail [data-close]').click();
 await page.locator('#search').fill('粗陶');assert.equal(await page.locator('.product-card').count(),1);
 await page.locator('#search').fill('');await page.locator('[data-category="藏地旅行纪念"]').click();assert.equal(await page.locator('.product-card').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.goto(origin+'/preview.html');await page.locator('[data-product="p01"]').click();assert.match(await page.locator('.gallery-caption').textContent(),/图片待上传/);
 assert.deepEqual(errors,[]);
 console.log('PASS browser: legacy cart, gallery/thumbnails/swipe, variant switch/quantity, cart photos/totals, PNG download/photos, generic/missing photos, search/categories, mobile overflow, bundled preview');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
