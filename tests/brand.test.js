import test from 'node:test';
import assert from 'node:assert/strict';
import {brandConfig,validateBrand,brandMissing,contactLines,brandFooter,pageWatermarkSvg,loadBrandQrs} from '../src/brand.js';
import {watermarkSvg,adaptiveInk,contrastOutline,brandMarkSvg,signatureSvg} from '../scripts/watermark-renderer.mjs';
const fixture=()=>({...brandConfig,name:'测试商家',customerServices:[{label:'客服1',wechatId:'test_service_01',qrCodePath:'public/branding/customer1.png'},{label:'客服2',wechatId:'test_service_02',qrCodePath:'public/branding/customer2.png'}],websiteUrl:'https://example.test/catalog',showWebsiteUrl:true,imageWatermark:{...brandConfig.imageWatermark},pageWatermark:{...brandConfig.pageWatermark}});
test('merchant configuration validates both contacts, opacity, scale, angles and URL opt-in',()=>{
 assert.equal(validateBrand(fixture()).customerServices[0].wechatId,'test_service_01');
 assert.equal(brandConfig.imageWatermark.fontScale,0.3);assert.equal(brandConfig.imageWatermark.opacity,0.6);assert.equal(brandConfig.imageWatermark.angle,-25);
 for(const change of [{websiteUrl:'javascript:alert(1)'},{websiteUrl:'https://user:secret@example.test'},{customerServices:[{label:'x',wechatId:'bad\nvalue'}]},{customerServices:[{label:'x',wechatId:'test_id',qrCodePath:'public/branding/../secret.png'}]},{imageWatermark:{...brandConfig.imageWatermark,opacity:1.2}},{imageWatermark:{...brandConfig.imageWatermark,outlineRatio:-0.1}},{imageWatermark:{...brandConfig.imageWatermark,fontAssetPath:'../private.woff2'}}])assert.throws(()=>validateBrand({...fixture(),...change}));
});
test('real contact IDs are configured globally; QR paths are configured and websites stay hidden',async()=>{
 assert.deepEqual(brandConfig.customerServices.map(s=>s.wechatId),['15289007429','18673575510']);
 assert.deepEqual(brandMissing(),[]);assert.deepEqual(await loadBrandQrs({...brandConfig,customerServices:brandConfig.customerServices.map(service=>({...service,qrCodePath:null}))}),[]);
 const hidden={...fixture(),showWebsiteUrl:false};assert.ok(!contactLines(hidden).join('\n').includes('example.test'));
 assert.ok(!pageWatermarkSvg(hidden).includes('example.test'));
});
test('adaptive image watermark renders medium glyph paths with contrasting outlines and alternates the two services',async()=>{
 const config=fixture();assert.equal(adaptiveInk(0.1,config),config.imageWatermark.lightColor);assert.equal(adaptiveInk(0.9,config),config.imageWatermark.darkColor);
 const first=(await watermarkSvg(1000,'#41463d',config,0)).toString(),second=(await watermarkSvg(1000,'#41463d',config,1)).toString();
 assert.equal(contrastOutline('#000000'),'#ffffff');assert.equal(contrastOutline('#ffffff'),'#000000');
 assert.match(first,/stroke="#ffffff"/);assert.match(first,/paint-order="stroke fill"/);
 assert.match(first,/opacity="0.6"/);assert.match(first,/<path vector-effect="non-scaling-stroke" d=/);assert.doesNotMatch(first,/<text/);assert.notEqual(first,second);
});
test('page watermark escapes merchant content and contains both WeChat IDs',()=>{
 const svg=pageWatermarkSvg({...fixture(),name:'商家<&"'});
 assert.ok(svg.includes('商家&lt;&amp;&quot;'));assert.ok(svg.includes('test_service_01'));assert.ok(svg.includes('test_service_02'));assert.match(svg,/rotate\(-25\)/);
});
test('export branding includes both actual contacts, optional website and two separately labelled QR quiet zones',()=>{
 const calls=[];const config=fixture(),image={naturalWidth:400,naturalHeight:400};
 const ctx={fillText:(...args)=>calls.push(['text',...args]),fillRect:(...args)=>calls.push(['rect',...args]),drawImage:(...args)=>calls.push(['qr',...args]),measureText:s=>({width:s.length*10})};
 brandFooter(ctx,500,config.customerServices.map(service=>({service,image})),config);
 for(const text of ['测试商家','test_service_01','test_service_02','https://example.test'])assert.ok(calls.some(c=>c[0]==='text' && c[1].includes(text)));
 assert.equal(calls.filter(c=>c[0]==='rect' && c[3]===350).length,2);assert.equal(calls.filter(c=>c[0]==='qr').length,2);
 calls.length=0;brandFooter(ctx,500,[],{...config,showWebsiteUrl:false});assert.ok(!calls.some(c=>c[0]==='text' && c[1].includes('example.test')));
});
test('configured but unreadable QR blocks export instead of replacing it with a fictional code',async()=>{
 const old=globalThis.Image;
 try{
  globalThis.Image=class{set src(value){queueMicrotask(()=>this.onerror?.());}};
  await assert.rejects(loadBrandQrs(fixture()),/客服[12]二维码加载失败/);
 }finally{globalThis.Image=old;}
});
test('medium-weight outlined watermark has stronger raster ink than the previous light 35% style',async()=>{
 const {default:sharp}=await import('sharp');
 const {create}=await import('fontkit');const {readFile}=await import('node:fs/promises');
 const face=create(await readFile(brandConfig.imageWatermark.fontAssetPath));
 assert.equal(face.postscriptName,'NotoSansCJKsc-Medium');assert.equal(face['OS/2'].usWeightClass,500);
 const previous={...brandConfig,imageWatermark:{...brandConfig.imageWatermark,fontAssetPath:'assets/fonts/NotoSansCJKsc-Light.woff2',opacity:0.35,outlineRatio:0,minOutlinePx:0}};
 const strength=async svg=>{
  const {data,info}=await sharp(svg).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let sum=0,peak=0;
  for(let index=3;index<data.length;index+=info.channels){sum+=data[index];peak=Math.max(peak,data[index]);}
  return {sum,peak};
 };
 for(const color of ['#000000','#ffffff']){
  const old=await strength(await watermarkSvg(640,color,previous));
  const current=await strength(await watermarkSvg(640,color));
  assert.ok(current.sum>old.sum*1.5,'New glyph weight and opacity must produce materially stronger ink');
  assert.ok(current.peak>=150 && current.peak<=154,'Combined fill/outline must remain at 60%, without stacked opacity');
  assert.ok(current.peak>old.peak+40);
 }
});

test('brand identity text is exact and registered trademark use is disabled',()=>{
 assert.equal(brandConfig.name,'扎西德勒鸭');
 assert.equal(brandConfig.englishName,'TIBETAN CRAFTS');
 assert.equal(brandConfig.subtitle,'藏地风物 · 生活美学');
 assert.equal(brandConfig.useRegisteredTrademark,false);
 assert.deepEqual(brandConfig.customerServices.map(service=>[service.wechatId,service.qrCodePath]),[
  ['15289007429','public/branding/wechat-15289007429.jpg'],
  ['18673575510','public/branding/wechat-18673575510.jpg'],
 ]);
 assert.throws(()=>validateBrand({...brandConfig,useRegisteredTrademark:true}),/separate confirmation/);
});

test('three-layer text comes from exact configuration, with serif artwork and no registered mark',async()=>{
 const {create}=await import('fontkit');const {readFile}=await import('node:fs/promises');
 const face=create(await readFile(brandConfig.brandVisual.fontAssetPath));assert.equal(face.postscriptName,'NotoSerifCJKsc-Regular');
 const text=[brandConfig.name,brandConfig.englishName,brandConfig.subtitle,...brandConfig.customerServices.map(service=>service.label+'微信：'+service.wechatId)].join(' ');
 assert.ok(face.layout(text).glyphs.every(glyph=>glyph.id>0),'Every confirmed character must have a real glyph, including the subtitle middle dot');
 const logo=(await brandMarkSvg(330,'#42483e')).toString(),footer=(await signatureSvg(1100,132)).toString();
 for(const value of [brandConfig.name,brandConfig.englishName,brandConfig.subtitle])assert.ok(logo.includes(value));
 for(const service of brandConfig.customerServices)assert.ok(footer.includes(service.wechatId));
 for(const artwork of [logo,footer]){assert.doesNotMatch(artwork,/<text/);assert.ok(artwork.includes('<polyline'));assert.ok(!artwork.includes(String.fromCharCode(0x00ae)));}
 assert.throws(()=>validateBrand({...brandConfig,name:brandConfig.name+String.fromCharCode(0x00ae)}));
});

test('reference template embeds only the two unchanged uploaded QR images and invalidates QR edits',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svg=(await signatureSvg(1100,264)).toString();
 assert.equal((svg.match(/<image /g)||[]).length,2);
 for(const service of brandConfig.customerServices){
  const original=await readFile(service.qrCodePath);
  assert.ok(svg.includes(original.toString('base64')),'QR must embed exact original bytes');
 }
 assert.equal((svg.match(/preserveAspectRatio="xMidYMid meet"/g)||[]).length,2);
 assert.ok(svg.includes(brandConfig.subtitle));
 const hidden=structuredClone(brandConfig);hidden.brandVisual.footer.showQrCodes=false;
 assert.ok(!(await signatureSvg(1100,264,hidden)).toString().includes('<image '));
});
