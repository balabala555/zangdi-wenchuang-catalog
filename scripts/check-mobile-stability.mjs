import assert from 'node:assert/strict';
import {createServer} from '../server.js';
import {homeConfig} from '../src/homepage.js';
import {homepagePhotos} from '../src/generated-homepage-images.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 await page.addInitScript(()=>{new MutationObserver(()=>{if(!window.initialLogo)window.initialLogo=document.querySelector('.brand img');}).observe(document,{childList:true,subtree:true});});
 await page.route('**/public/branding/logo-color.png',async r=>{await new Promise(done=>setTimeout(done,600));await r.continue();});
 await page.route('**/*-home-*.webp',async r=>{await new Promise(done=>setTimeout(done,700));await r.continue();});
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('[data-home-category]').first().waitFor();
 const before=await page.locator('.home-category img').evaluateAll(imgs=>imgs.map(i=>({h:i.getBoundingClientRect().height,w:i.getBoundingClientRect().width,attrs:i.hasAttribute('width')&&i.hasAttribute('height')})));
 await page.locator('.home-category img').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';await i.decode();})));
 const after=await page.locator('.home-category img').evaluateAll(imgs=>imgs.map(i=>({h:i.getBoundingClientRect().height,w:i.getBoundingClientRect().width})));
 before.forEach((v,i)=>{assert.ok(v.attrs);assert.ok(v.h>0);assert.ok(Math.abs(v.h-after[i].h)<1 && Math.abs(v.w-after[i].w)<1);});
 await page.locator('.brand-logo').first().evaluate(i=>i.decode());assert.equal(await page.evaluate(()=>initialLogo===document.querySelector('.brand img')),true,'Logo node must not be recreated while loading');
 const logo=await page.locator('.brand-logo').first().boundingBox();assert.ok(Math.abs(logo.width/logo.height-1220/580)<.01);
 await page.addStyleTag({content:'body{padding-top:34px!important}.bottom-nav{padding-bottom:45px!important}'});
 assert.ok((await page.locator('.brand-logo').first().boundingBox()).y>=34);
 await page.waitForFunction(()=>parseFloat(getComputedStyle(document.body).paddingBottom)>=document.querySelector('.bottom-nav').getBoundingClientRect().height+15);
 await page.evaluate(()=>scrollTo(0,document.scrollingElement.scrollHeight));
 assert.ok(await page.evaluate(()=>document.querySelector('footer').getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top));
 await page.evaluate(()=>{const t=document.querySelector('#toast');t.textContent='清单已更新';t.classList.add('show');});assert.ok(await page.evaluate(()=>document.querySelector('#toast').getBoundingClientRect().bottom<document.querySelector('.bottom-nav').getBoundingClientRect().top));
 await page.setViewportSize({width:390,height:500});await page.locator('[data-feature-product="soft-lamb"]').click();
 await page.waitForFunction(()=>parseFloat(document.documentElement.style.getPropertyValue('--visual-viewport-height'))<=500);
 const action=await page.locator('#add-cart').boundingBox();assert.ok(action.y>=0 && action.y+action.height<=500);
 await page.close();
 const source=homeConfig.categories[0].photo,p=homepagePhotos[source];
 const retry=await browser.newPage({viewport:{width:390,height:844}});let recover=false;
 await retry.route('**/*',async route=>{const u=new URL(route.request().url()).pathname.slice(1);if(u===p.thumb.path||u===p.card.path||u===p.public.path&&!recover)return route.abort();return route.continue();});
 await retry.goto(origin);const tile=retry.locator('[data-home-category]').first();await tile.scrollIntoViewIfNeeded();await retry.waitForFunction(()=>document.querySelector('.home-category').classList.contains('image-failed'));
 const failed=await tile.boundingBox();assert.ok(failed.height>80);assert.match(await tile.textContent(),/随手带走/);
 recover=true;await retry.evaluate(()=>window.dispatchEvent(new Event('online')));await tile.locator('img').evaluate(i=>i.decode());assert.equal(await tile.evaluate(e=>e.classList.contains('image-failed')),false);assert.ok((await tile.locator('img').getAttribute('src')).endsWith(p.public.path));await retry.close();
 for(const [name,width,ua]of [['iPhone-Safari-UA',390,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'],['Android-WeChat-UA',412,'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0']]){
  const simulated=await browser.newPage({viewport:{width,height:844},userAgent:ua,hasTouch:true});await simulated.goto(origin);if(await simulated.locator('#home-hero-photo img').count()===0)await simulated.locator('[data-store-index="1"]').click();await simulated.locator('#home-hero-photo img').evaluate(i=>i.decode());assert.equal(await simulated.locator('[data-home-category]').count(),7);assert.equal(await simulated.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await simulated.close();console.log('PASS Chromium viewport/UA simulation only:',name);
 }
 console.log('PASS mobile stability: preserved logo, slow-image geometry, failed-photo fallback/online retry, measured nav clearance and viewport resize');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
