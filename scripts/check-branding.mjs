// Customer details and QR below are network-only fixtures; never publish them as merchant contact data.
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:667},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/brand.js',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nbrandConfig.assets.enabled=false;brandConfig.customerServices=[{label:'客服1',wechatId:'test_service_01',qrCodePath:'public/branding/test-qr1.png'},{label:'客服2',wechatId:'test_service_02',qrCodePath:'public/branding/test-qr2.png'}];brandConfig.websiteUrl='https://example.test/catalog';brandConfig.showWebsiteUrl=true;`});
 });
 await page.route('**/public/branding/test-qr*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=','base64')}));
 await page.addInitScript(()=>{
  localStorage.setItem('shan-cart',JSON.stringify([{id:'felt-mushroom-bag',variant:'浅薄荷绿',quantity:1}]));
  window.exportText=[];window.exportImages=[];
  const text=CanvasRenderingContext2D.prototype.fillText,image=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.exportText.push(value);return text.call(this,value,...args);};
  CanvasRenderingContext2D.prototype.drawImage=function(value,...args){window.exportImages.push(value.src);return image.call(this,value,...args);};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::after').pointerEvents),'none');
 assert.ok(await page.evaluate(()=>getComputedStyle(document.body,'::after').backgroundImage.includes('test_service_01')));
 await page.locator('[data-product="felt-mushroom-bag"]').click();
 assert.match(await page.locator('.brand-contact').textContent(),/扎西德勒鸭.*test_service_01.*test_service_02/);
 const action=await page.locator('#add-cart').boundingBox();assert.ok(action.y+action.height<=667);
 await page.locator('[data-variant="亮蓝色"]').click();await page.locator('#detail [data-close]').click();
 await page.locator('#open-list').click();await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
 const rendered=await page.evaluate(()=>({text:window.exportText,images:window.exportImages}));
 assert.ok(rendered.text.some(t=>t==='扎西德勒鸭'));assert.ok(rendered.text.some(t=>t.includes('test_service_01')));assert.ok(rendered.text.some(t=>t.includes('https://example.test/catalog')));
 assert.ok(rendered.images.some(p=>p?.endsWith('/public/branding/test-qr1.png')));assert.ok(rendered.images.some(p=>p?.endsWith('/public/branding/test-qr2.png')));
 assert.deepEqual(errors,[]);
 console.log('PASS configurable brand fixture: distributed page watermark does not block browsing, fixed contact/action bar visible, PNG includes configured brand/WeChat/website/QR');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
