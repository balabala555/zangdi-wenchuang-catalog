// PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs node scripts/check-real-product.mjs
import assert from 'node:assert/strict';
import {photoUrl} from '../src/images.js';
import {createServer} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,permissions:['clipboard-read','clipboard-write']});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.drawnPhotos=[];
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...args){window.drawnPhotos.push(img.src);return draw.call(this,img,...args);};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('[data-category="羊毛毡生活好物"]').click();
 assert.equal(await page.locator('.product-card').count(),1);
 for(const [variant,file] of [['浅灰色','light-gray.jpg'],['浅薄荷绿','light-mint.jpg'],['亮蓝色','bright-blue.jpg']]){
  await page.locator('[data-product="felt-mushroom-bag"]').click();
  await page.locator(`[data-variant="${variant}"]`).click();
  const img=page.locator('.gallery-stage img');assert.ok((await img.getAttribute('src')).endsWith(photoUrl('public/images/felt-mushroom-bag/'+file).slice(2)));
  await img.evaluate(async el=>{await el.decode();if(!el.naturalWidth)throw Error('Image failed');});
  assert.equal(await page.locator('[data-photo]').count(),0);
  assert.match(await page.locator('.gallery-caption').textContent(),/1 \/ 1/);
  await page.locator('#add-cart').click();
 }
 await page.locator('#open-list').click();assert.equal(await page.locator('.list-item').count(),3);
 for(const [i,file] of ['light-gray.jpg','light-mint.jpg','bright-blue.jpg'].entries())assert.ok((await page.locator('.list-item').nth(i).locator('img').getAttribute('src')).endsWith(photoUrl('public/images/felt-mushroom-bag/'+file,'thumb').slice(2)));
 assert.match(await page.locator('.list-total').textContent(),/270/);
 await page.locator('#copy-list').click();
 const text=await page.locator('#copy-fallback').count()?await page.locator('#copy-fallback').inputValue():await page.evaluate(()=>navigator.clipboard.readText());
 for(const variant of ['浅灰色','浅薄荷绿','亮蓝色'])assert.ok(text.includes(variant));
 await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
 const ready=page.waitForEvent('download');await page.locator('#download-image').click();const download=await ready;
 assert.equal(await download.failure(),null);assert.match(download.suggestedFilename(),/\.png$/);
 const drawn=await page.evaluate(()=>window.drawnPhotos);
 assert.deepEqual(drawn.map(p=>p.split('/').pop()),['light-gray.jpg','light-mint.jpg','bright-blue.jpg'].map(file=>photoUrl('public/images/felt-mushroom-bag/'+file,'thumb').split('/').pop()));
 assert.deepEqual(errors,[]);
 console.log('PASS real photos: category, three colors load/decode, no mixed gallery, three cart rows, total ¥270, text copy and PNG download with matching original photos');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
