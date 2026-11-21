import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../server.js';
import {siteConfig} from '../src/site.js';
import {photoDimensions,photoUrl} from '../src/images.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const out=process.env.STORE_SCREENSHOTS||'docs/screenshots/v1.3.2';await mkdir(out,{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 for(const [device,width,height]of [['mobile',390,844],['desktop',1440,1000],['offline',390,844]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:device!=='desktop'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(device==='offline')await page.route('**/public/**',r=>r.abort());
  await page.goto(origin+(device==='offline'?'/preview.html':''));
  for(const [index,store]of siteConfig.stores.entries()){
   await page.locator(`[data-store-index="${index}"]`).click();const img=page.locator('#home-hero-photo img');await img.evaluate(i=>i.decode());
   assert.equal(await img.evaluate(i=>getComputedStyle(i).objectFit),'contain');
   const dims=photoDimensions(store.photo,'detail'),stage=await page.locator('#home-hero-photo').boundingBox();
   if(device!=='desktop')assert.ok(Math.abs(stage.width/stage.height-dims.width/dims.height)<.01,'Phone stage follows original aspect ratio');
   const measured=await img.evaluate(i=>{const box=i.getBoundingClientRect(),frame=i.closest('.hero-art').getBoundingClientRect();return {x:box.x,y:box.y,w:box.width,h:box.height,fx:frame.x,fy:frame.y,fw:frame.width,fh:frame.height,nw:i.naturalWidth,nh:i.naturalHeight};});
   assert.ok(Math.abs(measured.x-measured.fx)<1&&Math.abs(measured.y-measured.fy)<1);assert.ok(measured.w<=measured.fw+1&&measured.h<=measured.fh+1);
   assert.ok(Math.abs(measured.nw/measured.nh-dims.width/dims.height)<.01,'No preprocessed crop in rendered source');
   if(device!=='offline'){await page.locator('.home-photo,.product-card img,.brand-logo').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';await i.decode();})));await page.screenshot({path:`${out}/${device}-${store.id}-home.png`,fullPage:true});}
   await page.locator('[data-view-store]').click();assert.ok(await page.locator('#store-viewer').isVisible());assert.equal(await page.locator('#store-viewer-title').textContent(),store.location+'｜'+store.name);
   const full=page.locator('#store-viewer-photo img');await full.evaluate(i=>i.decode());
   const geometry=await full.evaluate(i=>({w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height,nw:i.naturalWidth,nh:i.naturalHeight}));
   assert.ok(Math.abs(geometry.w/geometry.h-dims.width/dims.height)<.01);assert.ok(Math.abs(geometry.nw/geometry.nh-dims.width/dims.height)<.01);
   if(device!=='offline'){assert.ok((await full.getAttribute('src')).endsWith(photoUrl(store.photo,'detail').slice(2)));await page.screenshot({path:`${out}/${device}-${store.id}-full-photo.png`});}
   if(index===0)await page.locator('#store-viewer [data-close]').click();else await page.keyboard.press('Escape');assert.equal(await page.locator('#store-viewer').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.locator('#home-hero-photo').evaluate(el=>{const event=(type,x,y)=>{const e=new Event(type,{bubbles:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:x,clientY:y}]});el.dispatchEvent(e);};event('touchstart',200,100);event('touchend',90,105);});
  await page.locator('[data-view-store]').dispatchEvent('click');assert.equal(await page.locator('#store-viewer').isVisible(),false,'Swipe synthetic click must not open viewer');
  assert.match(await page.locator('#store-caption').textContent(),/八廓商场店/);assert.deepEqual(errors,[]);await page.close();console.log('PASS V1.3.2 '+device+': both uncropped store ratios, contain, full protected viewer, close/Escape, no swipe ghost click or overflow');
 }
 const failed=await browser.newPage();const blocked=new Set(['thumb','card','detail','original'].map(size=>new URL(photoUrl(siteConfig.stores[0].photo,size),origin).href));await failed.route('**/public/images/**',r=>blocked.has(r.request().url())?r.abort():r.continue());await failed.goto(origin);await failed.locator('[data-view-store]').click();await failed.waitForFunction(()=>document.querySelector('#store-viewer-photo').classList.contains('image-failed'));assert.ok(await failed.locator('#store-viewer [data-close]').isVisible());await failed.locator('#store-viewer [data-close]').click();await failed.locator('[data-store-index="1"]').click();await failed.locator('#home-hero-photo img').evaluate(i=>i.decode());assert.equal(await failed.locator('#home-hero-photo').evaluate(el=>el.classList.contains('image-failed')),false);await failed.close();console.log('PASS V1.3.2 failed photos keep a closable labelled viewer');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
