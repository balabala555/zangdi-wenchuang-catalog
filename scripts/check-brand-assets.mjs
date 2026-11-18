import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from '../server.js';
import {brandConfig} from '../src/brand.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const mode of ['web','offline','dark']){
  const page=await browser.newPage({viewport:{width:390,height:667}});
  await page.addInitScript(()=>{
   localStorage.setItem('shan-cart',JSON.stringify([{id:'felt-mushroom-bag',variant:'浅灰色',quantity:1}]));
   window.drawnAssets=[];const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){window.drawnAssets.push({src:image.src,args});return original.call(this,image,...args);};
  });
  if(mode==='offline')await page.route('**/public/branding/**',route=>route.abort());
  if(mode==='dark')await page.route('**/src/style.css',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n.header{background:#343b32!important}'});});
  await page.goto(origin+(mode==='offline'?'/preview.html':'/'));
  const logo=page.locator('.brand-logo').first();await logo.evaluate(image=>image.decode());
  const expected=brandConfig.assets.files[mode==='dark'?'logo-on-dark':'logo-color'];
  const src=await logo.getAttribute('src');
  if(mode==='offline')assert.equal(createHash('sha256').update(Buffer.from(src.split(',')[1],'base64')).digest('hex'),expected.sha256);
  else assert.ok(src.endsWith(expected.path));
  const box=await logo.boundingBox();assert.ok(Math.abs(box.width/box.height-1220/580)<0.01);assert.ok(box.x>=0 && box.x+box.width<=390);
  await page.locator('#open-list').click();await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
  const draws=await page.evaluate(()=>window.drawnAssets);
  const footer=draws.find(d=>d.src?.endsWith('/footer.png') || d.src?.startsWith('data:image/png;base64,') && createFooter(d.src));
  function createFooter(src){return createHash('sha256').update(Buffer.from(src.split(',')[1],'base64')).digest('hex')===brandConfig.assets.files.footer.sha256;}
  assert.ok(footer,'Export must draw supplied footer, not recreated artwork');
  assert.equal(footer.args[2]/footer.args[3],3200/900);
  await page.close();
 }
 const page=await browser.newPage();
 await page.addInitScript(()=>localStorage.setItem('shan-cart',JSON.stringify([{id:'felt-mushroom-bag',variant:'浅灰色',quantity:1}])));
 await page.route('**/public/branding/footer.png',route=>route.abort());
 await page.goto(origin);await page.locator('#open-list').click();await page.locator('#export-image').click();
 await page.waitForFunction(()=>document.querySelector('#export-image').disabled===false);
 assert.equal(await page.locator('#export-preview').count(),0,'Missing footer must block an incomplete export');
 console.log('PASS V1.1: approved light/dark logos, mobile proportions, offline exact bytes, export original footer and missing-footer error');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
