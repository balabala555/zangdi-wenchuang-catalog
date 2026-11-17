// Test fixtures exist only in intercepted network responses, never in product data files.
import assert from 'node:assert/strict';
import {createServer} from '../server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});
 const imageRequests=[];page.on('request',r=>{if(r.resourceType()==='image')imageRequests.push(r.url());});
 await page.route('**/src/data.js',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nfor(let i=0;i<1000;i++)products.push({...products[6],id:'fixture-'+i,name:'fixture-'+i});`});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 assert.equal(await page.locator('.product-card').count(),24);
 assert.match(await page.locator('#results-count').textContent(),/1007/);
 await page.locator('#load-more').click();assert.equal(await page.locator('.product-card').count(),48);
 await page.locator('#search').fill('fixture-999');assert.equal(await page.locator('.product-card').count(),1);
 assert.equal(await page.locator('#load-more').isVisible(),false);
 await page.locator('.product-card').click();await page.locator('.gallery-stage img').evaluate(el=>el.decode());
 assert.ok(imageRequests.filter(u=>u.includes('/optimized/')).length<10);
 console.log('PASS 1000 network-only fixtures: initial 24 cards, load next 24, global search, lazy size-specific requests without mass photo preloading');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
