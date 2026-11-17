// Browser geometry/export checks. Optional QR scanning: scripts/check-qr-scan.py (local open-source decoder).
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.js';
import {brandConfig} from '../src/brand.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=process.env.QR_TEST_OUTPUT || '/tmp/catalog-qr-check';await mkdir(output,{recursive:true});
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 for(const standalone of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:667},hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('shan-cart',JSON.stringify(['浅灰色','浅薄荷绿','亮蓝色'].map(variant=>({id:'felt-mushroom-bag',variant,quantity:1})))));
  if(standalone)await page.route('**/public/branding/**',route=>route.abort());
  await page.goto(origin+(standalone?'/preview.html':'/'));
  await page.locator('#open-contact').click();assert.equal(await page.locator('.contact-qr-full').count(),2);
  assert.equal(await page.locator('#contact-dialog').evaluate(el=>getComputedStyle(el,'::after').display),'none');
  for(let index=0;index<2;index++){
   const service=brandConfig.customerServices[index],card=page.locator('.contact-card').nth(index),img=card.locator('.contact-qr-full');
   assert.ok((await card.textContent()).includes(service.wechatId));
   await img.evaluate(image=>image.decode());
   const dimensions=await img.evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight}));assert.deepEqual(dimensions,{width:888,height:1131});
   const box=await img.boundingBox();assert.ok(Math.abs(box.width/box.height-888/1131)<0.002);
   await img.scrollIntoViewIfNeeded();
   await img.screenshot({path:output+`/${standalone?'offline':'web'}-${service.wechatId}.png`});
  }
  assert.equal(await page.locator('#contact-dialog .close').isVisible(),true);
  await page.locator('#contact-dialog .close').click();
  await page.locator('[data-product="felt-mushroom-bag"]').click();
  assert.equal(await page.locator('.contact-qr-mini').count(),2);
  const action=await page.locator('#add-cart').boundingBox();assert.ok(action.y>=0 && action.y+action.height<=667);
  await page.locator('[data-open-service="1"]').click();assert.equal(await page.locator('#contact-dialog').isVisible(),true);
  assert.ok((await page.locator('#service-1').textContent()).includes('18673575510'));
  await page.locator('#contact-dialog .close').click();await page.locator('#detail [data-close]').click();
  await page.locator('#open-list').click();await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
  const png=await page.locator('#export-preview').getAttribute('src');
  await writeFile(output+`/${standalone?'offline':'web'}-cart.png`,Buffer.from(png.split(',')[1],'base64'));
  const ready=page.waitForEvent('download');await page.locator('#download-image').click();assert.equal(await (await ready).failure(),null);
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${standalone?'offline':'web'}: both original QR files, fixed contact/detail access, no QR watermark overlay, aspect ratios preserved, PNG and explicit download`);
 }
 console.log('QR scan artifacts: '+output);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
