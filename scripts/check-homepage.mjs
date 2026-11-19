import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const out=process.env.HOMEPAGE_SCREENSHOTS||'docs/screenshots';await mkdir(out,{recursive:true});const metrics=[];
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const [name,width,height]of [['mobile',390,844],['desktop',1440,1000]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:name==='mobile'?3:1,hasTouch:name==='mobile'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#home-hero-photo img').evaluate(i=>i.decode());
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--page-brand-watermark').includes('base64'));
  assert.equal(await page.locator('[data-home-category]').count(),7);assert.equal(await page.locator('[data-feature-product]').count(),2);
  assert.equal(await page.locator('.hero-placeholder').count(),0);
  const heroBox=await page.locator('#home-hero-photo').boundingBox();assert.ok(Math.abs(heroBox.width/heroBox.height-(width>1000?2.15:1.94))<0.02);
  const labelsFit=await page.locator('.home-category').evaluateAll(cards=>cards.every(card=>card.querySelector('img').getBoundingClientRect().bottom<=card.querySelector('span').getBoundingClientRect().top));assert.ok(labelsFit,'Category labels must remain below their pictures');
  const perf=await page.evaluate(()=>({navigationMs:Math.round(performance.now()),devicePixelRatio:devicePixelRatio,heroBytes:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='img' && r.name===document.querySelector('#home-hero-photo img').currentSrc).map(r=>r.encodedBodySize)[0],horizontalOverflow:document.documentElement.scrollWidth>innerWidth,external:performance.getEntriesByType('resource').filter(r=>!r.name.startsWith(location.origin)&&!r.name.startsWith('data:')).map(r=>r.name)}));
  assert.equal(perf.horizontalOverflow,false);assert.deepEqual(perf.external,[]);assert.ok(perf.heroBytes<500000,'Compressed hero budget must be under 500KB');metrics.push({device:name,...perf});
  await page.locator('.home-photo').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{i.loading='eager';await i.decode();})));
  await page.screenshot({path:`${out}/homepage-${name}-v1.2.0.png`,fullPage:true});
  await page.screenshot({path:`${out}/homepage-${name}-first-screen-v1.2.0.png`});
  await page.locator('[data-home-category="羊毛毡生活好物"]').click();assert.equal(await page.locator('.product-card').count(),1);
  await page.locator('#search').fill('彩虹小羊');assert.equal(await page.locator('.product-card').count(),1);
  await page.locator('[data-feature-product="soft-lamb"]').click();assert.match(await page.locator('#detail-title').textContent(),/软萌小羊/);await page.locator('#add-cart').click();
  await page.locator('[data-feature-product="rainbow-lamb"]').click();await page.locator('#add-cart').click();
  await page.locator('.bottom-nav [data-open-list]').click();assert.match(await page.locator('.list-total').textContent(),/45/);await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();await page.locator('#list-dialog [data-close]').click();
  await page.locator('[data-open-store]').click();await page.locator('#store-photo img').evaluate(i=>i.decode());await page.locator('#store-dialog [data-close]').click();
  await page.locator('#open-contact').click();assert.equal(await page.locator('.contact-qr-full').count(),2);assert.deepEqual(errors,[]);await page.close();
 }
 for(const width of [320,768]){const narrow=await browser.newPage({viewport:{width,height:844}});await narrow.goto(`http://127.0.0.1:${server.address().port}/`);assert.equal(await narrow.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Narrow/tablet overflow');await narrow.close();}
 const offline=await browser.newPage();await offline.route('**/public/**',r=>r.abort());await offline.goto(`http://127.0.0.1:${server.address().port}/preview.html`);await offline.locator('#home-hero-photo img').evaluate(i=>i.decode());assert.equal(await offline.locator('[data-home-category]').count(),7);await offline.close();
 await writeFile(`${out}/homepage-performance-v1.2.0.json`,JSON.stringify({note:'Local Chromium cold navigation; not a mobile network or Safari benchmark.',samples:metrics},null,2));
 console.log('PASS homepage: 7 categories, real hero/features, search, ¥45 cart/PNG, store/contact, no overflow/external requests, offline and screenshots',metrics);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
