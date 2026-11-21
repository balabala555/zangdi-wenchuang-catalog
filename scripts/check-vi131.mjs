import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../server.js';
import {products} from '../src/data.js';
import {cartPhoto,photoUrl} from '../src/images.js';
import {exportLayout} from '../src/export.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const rows=[['felt-mushroom-bag',2],['soft-lamb',3],['rainbow-lamb',2]].map(([id,quantity])=>({id,variant:products.find(p=>p.id===id).variants[0],quantity}));
const out='docs/screenshots/v1.3.1';await mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const origin=`http://127.0.0.1:${server.address().port}`;
 for(const mode of ['mobile','desktop','offline','thumb-failure','all-photo-failure']){
  const page=await browser.newPage({viewport:{width:mode==='desktop'?1440:390,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(rows=>{localStorage.setItem('shan-cart',JSON.stringify(rows));window.drawCalls=[];window.textCalls=[];const draw=CanvasRenderingContext2D.prototype.drawImage,text=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.drawImage=function(img,...args){window.drawCalls.push({src:img.src,args,alpha:this.globalAlpha});return draw.call(this,img,...args);};CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.textCalls.push({value,args,alpha:this.globalAlpha});return text.call(this,value,...args);};},rows);
  if(mode==='offline')await page.route('**/public/**',r=>r.abort());
  if(mode.includes('failure'))for(const row of rows.slice(1)){
   const p=products.find(p=>p.id===row.id),path=cartPhoto(p,row.variant);
   await page.route(origin+'/'+photoUrl(path,'thumb').slice(2),r=>r.abort());
   if(mode==='all-photo-failure')await page.route(origin+'/'+photoUrl(path,'original').slice(2),r=>r.abort());
  }
  await page.goto(origin+(mode==='offline'?'/preview.html':''));await page.locator('#open-list').click();assert.equal(await page.locator('.list-item').count(),3);assert.match(await page.locator('.list-total').textContent(),/290\.00/);
  assert.deepEqual(await page.locator('.list-item .quantity span').allTextContents(),['2','3','2']);
  if(mode==='all-photo-failure'){
   await page.waitForFunction(()=>document.querySelectorAll('.cart-photo.image-failed').length===2);for(const placeholder of await page.locator('.cart-photo.image-failed .cart-photo-placeholder').all())assert.ok(await placeholder.isVisible());
   await page.locator('#export-image').click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('照片加载失败'));assert.equal(await page.locator('#export-preview').count(),0);
  }else{
   await page.waitForFunction(()=>document.querySelectorAll('.cart-photo.image-loaded').length===3);
   const images=await page.locator('.cart-photo img').evaluateAll(es=>es.map(e=>({width:e.naturalWidth,visible:e.getBoundingClientRect().width,src:e.currentSrc})));assert.ok(images.every(i=>i.width>0&&i.visible>=88));
   if(mode==='thumb-failure')assert.ok(images.slice(1).every(i=>i.src.includes('/images/lamb/')&&i.src.endsWith('.jpg')));
   if(['mobile','desktop'].includes(mode))await page.screenshot({path:`${out}/${mode}-cart-dialog.png`});
   await page.locator('#export-image').click();await page.locator('#export-preview').waitFor();const image=page.locator('#export-preview');await image.evaluate(i=>i.decode());
   const texts=await page.evaluate(()=>textCalls);for(const value of ['参考合计：¥290.00','15289007429','18673575510'])assert.ok(texts.some(t=>t.value.includes(value)));
   for(const id of ['15289007429','18673575510'])assert.ok(texts.some(t=>t.alpha<1&&t.value.includes(id)),'Permanent distributed WeChat watermark');
   const draws=await page.evaluate(()=>drawCalls);assert.ok(draws.some(d=>d.alpha<1),'Watermark artwork drawn permanently');
   const photoDraws=draws.filter(d=>d.alpha===1&&d.args.length===4&&d.args[0]>=exportLayout.photoX&&d.args[0]<exportLayout.textX&&d.args[1]>=exportLayout.photoY&&d.args[1]<exportLayout.photoY+3*exportLayout.rowHeight&&d.args[2]<=exportLayout.photoWidth&&d.args[3]<=exportLayout.photoHeight);assert.equal(photoDraws.length,3);
   const url=await image.getAttribute('src');if(['mobile','desktop','offline'].includes(mode))await writeFile(`${out}/${mode}-290.png`,Buffer.from(url.split(',')[1],'base64'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);await page.close();console.log('PASS V1.3.1 '+mode+': 7 pieces / 290, photos or explicit fallback, protected export');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
