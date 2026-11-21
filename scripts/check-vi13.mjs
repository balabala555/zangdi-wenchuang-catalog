import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.js';
import {siteConfig} from '../src/site.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const out='docs/screenshots/v1.3.0';await mkdir(out,{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 for(const [name,width,height]of [['mobile',390,844],['desktop',1440,1000]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:name==='mobile'?3:1,hasTouch:name==='mobile'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.canvasText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.canvasText.push(value);return original.call(this,value,...args);};});
  await page.goto(origin);assert.equal(await page.title(),siteConfig.name);assert.equal(await page.locator('[data-home-category]').count(),7);
  assert.equal(await page.locator('#home-hero-photo img').count(),0);assert.match(await page.locator('#store-caption').textContent(),/八廓商场店｜扎西德勒鸭/);assert.match(await page.locator('.store-photo-pending').first().textContent(),/真实店铺照片待提供/);
  if(name==='mobile'){const r=await page.locator('.home-category').all();const a=await r[0].boundingBox(),b=await r[1].boundingBox(),c=await r[2].boundingBox();assert.ok(Math.abs(a.y-b.y)<1);assert.ok(c.y>a.y);}
  await page.locator('.home-photo,.product-card img,.brand-logo').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';await i.decode();})));
  await page.screenshot({path:`${out}/${name}-default-mall-pending.png`,fullPage:true});
  await page.locator('[data-store-index="1"]').click();await page.locator('#home-hero-photo img').evaluate(i=>i.decode());assert.match(await page.locator('#store-caption').textContent(),/八廓街店｜加西得了个鸭/);
  await page.screenshot({path:`${out}/${name}-street.png`,fullPage:true});
  await page.locator('#home-hero-photo').evaluate(el=>{const event=(type,x,y)=>{const e=new Event(type,{bubbles:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:x,clientY:y}]});el.dispatchEvent(e);};event('touchstart',100,100);event('touchend',100,220);});assert.match(await page.locator('#store-caption').textContent(),/八廓街店/);
  await page.locator('#home-hero-photo').evaluate(el=>{const event=(type,x,y)=>{const e=new Event(type,{bubbles:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:x,clientY:y}]});el.dispatchEvent(e);};event('touchstart',200,100);event('touchend',90,105);});assert.match(await page.locator('#store-caption').textContent(),/八廓商场店/);
  if(name==='desktop'){await page.locator('[data-store-next]').click();await page.locator('[data-store-prev]').click();}assert.match(await page.locator('#store-caption').textContent(),/八廓商场店/);
  await page.locator('.start-shopping').click();await page.locator('[data-product="felt-mushroom-bag"]').click();assert.equal(await page.locator('.variants img').count(),3);
  await page.locator('[data-delta="1"]').click();await page.locator('#add-more').click();assert.equal(await page.locator('#detail').isVisible(),true);await page.locator('[data-variant="亮蓝色"]').click();await page.locator('#add-cart').click();
  await page.locator('#open-list').click();assert.equal(await page.locator('.list-item').count(),2);assert.match(await page.locator('.list-total').textContent(),/270/);await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();
  const text=await page.evaluate(()=>canvasText);for(const value of [siteConfig.name,'八廓商场店｜扎西德勒鸭','八廓街店｜加西得了个鸭'])assert.ok(text.some(t=>t.includes(value)),value);
  assert.ok(text.some(t=>t.includes('单价¥90')));assert.ok(!text.some(t=>t.includes('localhost')));const png=await page.locator('#export-preview').getAttribute('src');await writeFile(`${out}/${name}-cart.png`,Buffer.from(png.split(',')[1],'base64'));
  await page.locator('[data-change="1"]').first().click();assert.match(await page.locator('.list-total').textContent(),/360/);await page.locator('[data-remove]').first().click();assert.match(await page.locator('.list-total').textContent(),/90/);await page.locator('#list-dialog [data-close]').click();
  await page.locator('#open-contact').click();assert.equal(await page.locator('.contact-card').count(),2);assert.match(await page.locator('#contact-dialog').textContent(),/添加不成功可联系另一位/);for(const n of ['15289007429','18673575510'])assert.ok((await page.locator('#contact-dialog').textContent()).includes(n));await page.locator('#contact-dialog .close').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(!(await page.locator('body').textContent()).includes('�'));
  const contrast=await page.evaluate(()=>{const get=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();const l=h=>{const a=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};const ratio=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);return {body:ratio(get('--ink'),get('--paper')),muted:ratio(get('--muted'),get('--paper')),button:ratio(get('--accent'),'#ffffff')};});for(const value of Object.values(contrast))assert.ok(value>=4.5,'Text contrast threshold');assert.deepEqual(errors,[]);await page.close();
 }
 const off=await browser.newPage();await off.route('**/public/**',r=>r.abort());await off.goto(origin+'/preview.html');await off.locator('[data-store-index="1"]').click();await off.locator('#home-hero-photo img').evaluate(i=>i.decode());assert.match(await off.title(),/扎西德勒鸭·藏地选物/);await off.close();
 console.log('PASS VI1.3: exact Chinese/site/store identities, honest missing mall photo, swipe/click, two-column categories, style photos, continued multi-style selection, cart arithmetic/removal, dual-store export, equal contacts and offline');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
