import {siteConfig,storeLines,onlineServices,validateSite} from './site.js';
import {homeConfig,categoryMatches} from './homepage.js';
import {releaseInfo} from './version.js';
import {brandConfig,validateBrand,brandFooter,loadBrandQrs,pageWatermarkSvg,loadPageWatermark,mountainSvg,brandAssetUrl,loadBrandFooter} from './brand.js';
import {photoDimensions,photoSrcset,preloadPhotos,photoUrl,photoPath,publicPhotos,productGallery,cartPhoto,loadPhoto,drawPhoto} from './images.js';
import {categories,products} from './data.js';
import {sanitizeCart,total,listText} from './cart.js';
const $=s=>document.querySelector(s);
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
validateBrand();validateSite(siteConfig,brandConfig);
document.documentElement.style.setProperty('--page-brand-opacity',siteConfig.visual.pageWatermarkOpacity);
loadPageWatermark().then(svg=>document.documentElement.style.setProperty('--page-brand-watermark','url("data:image/svg+xml,'+encodeURIComponent(svg)+'")')).catch(error=>console.warn('网页品牌水印加载失败：'+error.message));
document.documentElement.dataset.revision=releaseInfo.revision||'';
document.title=siteConfig.name;
if($('.release-version'))$('.release-version').textContent='测试版 v'+releaseInfo.version+' · VI '+releaseInfo.viVersion;
for(const element of [$('.brand>span:last-child'),$('footer>span')])if(element?.firstChild && !element.querySelector('img'))element.firstChild.textContent=brandConfig.name;
for(const small of document.querySelectorAll('.brand small,footer>span small'))small.textContent=brandConfig.englishName;
document.querySelectorAll('[data-site-name]').forEach(el=>el.textContent=siteConfig.name);
if($('.header-note'))$('.header-note').textContent=brandConfig.subtitle;
if(brandConfig.assets?.enabled){
  for(const [element,key] of [[$('.brand'),'logo-color'],[$('footer>span'),'logo-color']]){
    if(!element)continue;
    let image=element.querySelector('img.brand-logo');const existing=!!image;
    if(!image){image=document.createElement('img');image.className='brand-logo';}
    image.alt=brandConfig.name+' · '+brandConfig.subtitle;image.width=1220;image.height=580;image.decoding='async';image.loading=element.matches('.brand')?'eager':'lazy';
    if(element.matches('.brand'))image.setAttribute('fetchpriority','high');
    let surface=element,background='';
    while(surface){background=getComputedStyle(surface).backgroundColor;if(background!=='rgba(0, 0, 0, 0)' && background!=='transparent')break;surface=surface.parentElement;}
    const rgb=background.match(/[\d.]+/g);const dark=rgb && (Number(rgb[0])*0.2126+Number(rgb[1])*0.7152+Number(rgb[2])*0.0722)<128;
    const target=brandAssetUrl(dark?'logo-on-dark':key);
    if(!existing){image.src=target;element.replaceChildren(image);}
    else if(image.src!==new URL(target,document.baseURI).href){const replacement=new Image();replacement.src=target;replacement.decode().then(()=>{image.src=target;}).catch(()=>console.warn('品牌图片未能切换，保留已有标识'));}
    if(image.complete && !image.naturalWidth)image.alt=brandConfig.name;
    element.setAttribute('aria-label',siteConfig.name+'首页');
  }
}else if($('.brand .seal'))$('.brand .seal').innerHTML=mountainSvg();
function brandQrUrl(path){return typeof embeddedBrandQrs!=='undefined' && embeddedBrandQrs[path] || './'+path;}
const contactDialog=document.createElement('dialog');contactDialog.id='contact-dialog';contactDialog.setAttribute('aria-labelledby','contact-title');document.body.append(contactDialog);
const contactButton=document.createElement('button');contactButton.id='open-contact';contactButton.className='secondary';contactButton.textContent='微信客服';contactButton.setAttribute('aria-label','查看客服微信和二维码');document.body.append(contactButton);
function openContacts(focusIndex=0){
  contactDialog.innerHTML=`<button class="close" data-close aria-label="关闭客服联系区">×</button><div class="contact-content"><p class="eyebrow">${escapeHTML(siteConfig.name)}</p><h2 id="contact-title">联系微信客服</h2><p class="small-note">${escapeHTML(siteConfig.contactHint)}<br>长按二维码可识别或保存，也可复制微信号添加。</p><div class="contact-cards">${onlineServices(brandConfig).map(service=>({service,index:brandConfig.customerServices.indexOf(service)})).map(({service,index})=>`<section class="contact-card" id="service-${index}"><h3>${escapeHTML(service.label)}</h3><p class="contact-id">微信：${escapeHTML(service.wechatId)}</p>${service.qrCodePath?`<img class="contact-qr-full" src="${brandQrUrl(service.qrCodePath)}" alt="${escapeHTML(service.label)}微信原始二维码" loading="eager" decoding="async">`:''}<button class="secondary" data-copy-service="${index}">复制${escapeHTML(service.label)}微信号</button></section>`).join('')}</div></div>`;
  if(!contactDialog.open)contactDialog.showModal();
  contactDialog.querySelector('#service-'+focusIndex)?.scrollIntoView({block:'nearest'});
}
const bottomContact=document.querySelector('.bottom-nav [data-open-contact]');if(bottomContact)bottomContact.replaceWith(contactButton);
contactButton.addEventListener('click',()=>openContacts());
contactDialog.addEventListener('click',async e=>{
  if(e.target===contactDialog || e.target.closest('[data-close]')){contactDialog.close();return;}
  const button=e.target.closest('[data-copy-service]');if(!button)return;
  const service=brandConfig.customerServices[Number(button.dataset.copyService)];if(!service)return;
  try{await navigator.clipboard.writeText(service.wechatId);toast(service.label+'微信号已复制');}catch{toast('请长按上方微信号复制');}
});
function brandContactMarkup(){
  return `<div class="brand-contact"><strong>${escapeHTML(siteConfig.name)}</strong>${onlineServices(brandConfig).map(service=>({service,index:brandConfig.customerServices.indexOf(service)})).map(({service,index})=>`<button class="contact-copy" data-copy-contact="${index}" aria-label="复制${escapeHTML(service.label)}微信号">${escapeHTML(service.label)}微信：${escapeHTML(service.wechatId)} <span>复制</span></button>${service.qrCodePath?`<button class="contact-qr-button" data-open-service="${index}" aria-label="查看${escapeHTML(service.label)}原始微信二维码"><img class="contact-qr-mini" src="${brandQrUrl(service.qrCodePath)}" alt="${escapeHTML(service.label)}微信二维码，点击查看大图"><span>查看大图</span></button>`:''}`).join('')}</div>`;
}
$('#detail').addEventListener('click',async e=>{
  const qrButton=e.target.closest('[data-open-service]');if(qrButton){openContacts(Number(qrButton.dataset.openService));return;}
  const button=e.target.closest('[data-copy-contact]');if(!button)return;
  const service=brandConfig.customerServices[Number(button.dataset.copyContact)];if(!service)return;
  try{await navigator.clipboard.writeText(service.wechatId);toast(service.label+'微信号已复制');}
  catch{toast('请长按客服微信号复制');}
});
function imageMarkup(p, className='', photo=photoPath(p.coverImage) || publicPhotos(p)[0]) {
  const placeholder=`<div class="image-placeholder ${className}" role="img" aria-label="${escapeHTML(p.name)}，商品图片待上传"><span class="placeholder-symbol" aria-hidden="true">＋</span><strong>商品图片待上传</strong><small>临时占位 · 非商品实拍</small></div>`;
  if (!photo) return placeholder;
  // Relative, same-site images keep subdirectory deployments working.
  const path=photo.replace(/^\/+/, '');
  if (!/^public\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(path) || path.includes('..')) return placeholder;
  const size=className==='list-thumbnail' || className==='gallery-thumb'?'thumb':className==='detail-image'?'detail':'card';
  const srcset=size==='thumb'?'':photoSrcset(path,size);
  return `<div class="photo-frame ${className}"><img data-fallback="${photoUrl(path,'original')}" src="${photoUrl(path,size)}" ${srcset?`srcset="${srcset}" sizes="${className==='detail-image'?'(max-width:760px) 100vw, 425px':'(max-width:760px) 45vw, 400px'}"`:''} alt="${escapeHTML(p.name)}" loading="${className?'eager':'lazy'}" decoding="async">${placeholder}</div>`;
}
const failedHomeImages=new Set();
window.addEventListener('online',()=>{for(const img of failedHomeImages){if(!img.isConnected)continue;const frame=img.closest('.home-category,.home-feature,.hero-art,#store-photo')||img.parentElement;frame.classList.remove('image-failed');img.hidden=false;img.src=img.dataset.retryPhoto;delete img.dataset.retryPhoto;}failedHomeImages.clear();});
// A failed real-image request falls back to a labelled placeholder without a broken icon.
document.addEventListener('error',e=>{
  if(!(e.target instanceof HTMLImageElement))return;
  const img=e.target,fallback=img.dataset.fallback;
  if(img.classList.contains('brand-logo')){img.hidden=false;img.alt=brandConfig.name;return;}
  if(fallback && new URL(fallback,document.baseURI).href!==img.src){
    delete img.dataset.fallback;img.parentElement.querySelectorAll('source').forEach(source=>source.remove());img.removeAttribute('srcset');img.src=fallback;return;
  }
  img.hidden=true;const frame=img.closest('.home-category,.home-feature,.hero-art,#store-photo')||img.parentElement;frame.classList.add('image-failed');
  if(img.classList.contains('home-photo') && !img.dataset.retriedOnline){img.dataset.retryPhoto=img.src;img.dataset.retriedOnline='1';if(failedHomeImages.size<12)failedHomeImages.add(img);}
},true);
let cart=[];
try {cart=sanitizeCart(JSON.parse(localStorage.getItem('shan-cart')||'[]'));} catch {}
let category=categories[0], query='', selected=null, variant='', quantity=1, photoIndex=0, visibleLimit=24, toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function save(){clearExport();try{localStorage.setItem('shan-cart',JSON.stringify(cart));}catch{toast('浏览器无法保存清单，关闭页面后可能丢失');}updateCount();}
function updateCount(){$('#bag-count').textContent=cart.reduce((n,i)=>n+i.quantity,0);}
const moreButton=document.createElement('button');moreButton.id='load-more';moreButton.className='secondary';moreButton.textContent='查看更多好物';moreButton.hidden=true;$('#products').after(moreButton);
moreButton.addEventListener('click',()=>{visibleLimit+=24;renderProducts();});
function renderProducts(){
  $('#categories').innerHTML=categories.map(c=>`<button class="${c===category?'active':''}" aria-pressed="${c===category}" data-category="${c}">${c}</button>`).join('');
  const shown=products.filter(p=>(categoryMatches(p,category))&&`${p.name}${p.subtitle}${p.category}`.includes(query)).sort((a,b)=>Number(b.demo===false)-Number(a.demo===false));
  $('#results-count').textContent=`共 ${shown.length} 件好物`;
  $('#empty').hidden=shown.length>0;moreButton.hidden=shown.length<=visibleLimit;
  $('#products').innerHTML=shown.slice(0,visibleLimit).map(p=>`<button class="product-card" data-product="${p.id}" aria-label="查看${escapeHTML(p.name)}详情${p.demo===false?'':'，演示商品'}"><div class="product-image">${imageMarkup(p)}${p.demo===false?'':'<span class="demo-note">演示</span>'}</div><div class="product-info"><h3>${escapeHTML(p.name)}</h3><span class="price">¥${p.price.toFixed(2)}${p.unit?'/'+escapeHTML(p.unit):''}</span></div></button>`).join('');
}
$('#categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;visibleLimit=24;renderProducts();}});
$('#search').addEventListener('input',e=>{query=e.target.value.trim();category=categories[0];visibleLimit=24;renderProducts();});
$('#search').addEventListener('keydown',e=>{if(e.key==='Enter')$('#collection').scrollIntoView({behavior:'smooth'});});
$('#products').addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b)openDetail(b.dataset.product);});
function openDetail(id){selected=products.find(p=>p.id===id);variant=selected.variants[0];quantity=1;photoIndex=0;renderDetail();$('#detail').showModal();}
function variantButtons(p){return p.variants.map(v=>{const own=photoPath(p.variantImages?.[v]?.[0]);return `<button data-variant="${escapeHTML(v)}" class="${v===variant?'active':''}" aria-pressed="${v===variant}">${own?`<img src="${photoUrl(own,'thumb')}" alt="${escapeHTML(v)}实拍" width="50" height="50" decoding="async">`:''}<span>${escapeHTML(v)}${p.variants.length>1?`<small>¥${p.price.toFixed(2)} / ${p.unit||'件'}</small>`:''}</span></button>`;}).join('');}
function renderDetail(){const p=selected;$('#detail').innerHTML=`<button class="close" data-close aria-label="关闭商品详情">×</button><div class="detail-layout"><section id="gallery" class="gallery" aria-label="商品相册"></section><div class="detail-copy"><p class="eyebrow">${escapeHTML(p.category)}${p.demo===false?'':' · 演示商品'}</p><h2 id="detail-title">${escapeHTML(p.name)}</h2><span class="price">¥ ${p.price.toFixed(2)}${p.unit?' / '+escapeHTML(p.unit):''}</span><span class="variant-label">选择款式 <span class="small-note">照片与所选款式对应</span></span><div class="variants">${variantButtons(p)}</div><div class="specs">尺寸：${escapeHTML(p.size)}<br>材质：${escapeHTML(p.material)}</div><p class="product-description">${escapeHTML(p.description)}</p></div></div><div class="detail-actions">${brandContactMarkup()}<div class="add-row"><div class="quantity"><button data-delta="-1" aria-label="减少数量" ${quantity===1?'disabled':''}>−</button><span aria-live="polite">${quantity}</span><button data-delta="1" aria-label="增加数量" ${quantity===99?'disabled':''}>+</button></div><button class="primary" id="add-cart">加入选购清单</button></div><button class="continue-variants secondary" id="add-more">加入并继续选款</button><p class="small-note">${p.demo===false?'实物商品展示':'演示商品'} · 可分别选择款式和数量，多次加入清单 · 无需支付</p></div>`;renderGallery();}

let preloadTimer;
function renderGallery(){
  const {photos,generic}=productGallery(selected,variant);
  photoIndex=Math.max(0,Math.min(photoIndex,photos.length-1));
  $('#gallery').innerHTML=`<div class="gallery-stage" tabindex="0" aria-label="商品大图，左右滑动或方向键切换">${imageMarkup(selected,'detail-image',photos[photoIndex] || null)}</div><div class="gallery-caption" aria-live="polite">${escapeHTML(variant)} · ${photos.length ? `${photoIndex+1} / ${photos.length}${generic?' · 通用展示图':''}`:'商品图片待上传'}</div>${photos.length>1?`<div class="gallery-thumbnails" aria-label="选择商品照片">${photos.map((photo,index)=>`<button data-photo="${index}" aria-label="查看第 ${index+1} 张照片" aria-pressed="${index===photoIndex}">${imageMarkup(selected,'gallery-thumb',photo)}</button>`).join('')}</div>`:''}`;
  clearTimeout(preloadTimer);
  const nextVariant=selected.variants[(selected.variants.indexOf(variant)+1)%selected.variants.length];
  const nearby=[photos[photoIndex+1],cartPhoto(selected,nextVariant)].filter(photo=>photo && photo!==photos[photoIndex]);
  preloadTimer=setTimeout(()=>{if($('#detail').open)preloadPhotos(nearby);},200);

}
function movePhoto(delta){photoIndex+=delta;renderGallery();}
let swipeStart=null;
$('#detail').addEventListener('touchstart',e=>{
  const stage=e.target.closest('.gallery-stage');
  swipeStart=stage && e.touches.length===1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : null;
},{passive:true});
$('#detail').addEventListener('touchend',e=>{
  if(!swipeStart || !e.changedTouches.length)return;
  const dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;
  swipeStart=null;if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.5)movePhoto(dx<0?1:-1);
},{passive:true});
$('#detail').addEventListener('touchcancel',()=>{swipeStart=null;});
$('#detail').addEventListener('keydown',e=>{
  if(e.target.closest('.gallery-stage') && ['ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();movePhoto(e.key==='ArrowRight'?1:-1);$('#gallery .gallery-stage').focus();
  }
});
$('#detail').addEventListener('click',e=>{const button=e.target.closest('[data-photo]');if(button){photoIndex=Number(button.dataset.photo);renderGallery();$('#gallery [data-photo="'+photoIndex+'"]').focus();}});
$('#detail').addEventListener('click',e=>{
  const v=e.target.closest('[data-variant]'),d=e.target.closest('[data-delta]');
  if(v){variant=v.dataset.variant;photoIndex=0;renderGallery();$('#detail .variants').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===v);b.setAttribute('aria-pressed',b===v);});}
  if(d){quantity=Math.max(1,Math.min(99,quantity+Number(d.dataset.delta)));const buttons=$('#detail .quantity').querySelectorAll('button');$('#detail .quantity span').textContent=quantity;buttons[0].disabled=quantity===1;buttons[1].disabled=quantity===99;}
  if(e.target.closest('#add-cart')||e.target.closest('#add-more')){const old=cart.find(i=>i.id===selected.id&&i.variant===variant);if(old)old.quantity=Math.min(99,old.quantity+quantity);else cart.push({id:selected.id,variant,quantity});save();if(e.target.closest('#add-more')){quantity=1;renderDetail();$('#detail .variants [aria-pressed=true]')?.focus({preventScroll:true});toast('此款已加入，可继续选择其他款式');}else{$('#detail').close();toast('已加入清单，喜欢的好物已为你记下');}}
});
function renderList(){
  clearExport();
  $('#list-dialog').innerHTML=`<div class="list-content"><button class="close" data-close aria-label="关闭选购清单">×</button><p class="eyebrow">YOUR LITTLE COLLECTION</p><h2 id="list-title">我的选购清单</h2><p class="small-note">先收集喜欢，再与店主确认。清单仅保存在当前浏览器。</p>${cart.length?cart.map((i,index)=>{const p=products.find(p=>p.id===i.id);return `<article class="list-item">${imageMarkup(p,'list-thumbnail',cartPhoto(p,i.variant))}<div class="list-item-info"><h3>${p.name}</h3><p>${i.variant} · ¥${p.price.toFixed(2)} / ${p.unit || '件'}</p><div class="quantity"><button data-index="${index}" data-change="-1" aria-label="减少${p.name}数量" ${i.quantity===1?'disabled':''}>−</button><span>${i.quantity}</span><button data-index="${index}" data-change="1" aria-label="增加${p.name}数量" ${i.quantity===99?'disabled':''}>+</button></div><button class="remove" data-remove="${index}">移除</button></div><span class="price">¥${p.price*i.quantity}</span></article>`;}).join('')+`<div class="list-total"><span>参考合计</span><strong>¥ ${total(cart).toFixed(2)}</strong></div><p class="small-note">不含运费；库存、运费与成交价格请联系店主确认。清单仅为选购意向。</p><div class="list-actions"><button class="primary" id="export-image">分享／保存图片清单</button><button class="secondary" id="copy-list">复制文字清单</button></div><p class="small-note">生成图片后可分享给微信客服，或下载、长按图片保存。</p>`:'<div class="empty">清单还是空的。<br>去挑一件让你心动的好物吧。<br><button class="secondary" data-close>继续逛逛</button></div>'}</div>`;
}
$('#open-list').addEventListener('click',()=>{renderList();$('#list-dialog').showModal();});
$('#list-dialog').addEventListener('click',async e=>{
  const change=e.target.closest('[data-change]'),remove=e.target.closest('[data-remove]');
  if(change){const i=cart[Number(change.dataset.index)];i.quantity=Math.max(1,Math.min(99,i.quantity+Number(change.dataset.change)));save();renderList();}
  if(remove){cart.splice(Number(remove.dataset.remove),1);save();renderList();}
  if(e.target.closest('#copy-list')){try{await navigator.clipboard.writeText(listText(cart));toast('清单已复制，可粘贴发送给店主');}catch{let area=$('#copy-fallback');if(!area){area=document.createElement('textarea');area.id='copy-fallback';area.className='copy-fallback';area.readOnly=true;area.setAttribute('aria-label','请长按复制选购清单');$('#list-dialog .list-content').append(area);}area.value=listText(cart);area.focus();area.select();toast('请长按或手动复制下方文字');}}
  if(e.target.closest('#export-image'))await exportImage();
  if(e.target.closest('#share-image'))await shareExport();

});
let exportFile=null, exportUrl=null;
function clearExport(){
  exportFile=null;
  if(exportUrl)URL.revokeObjectURL(exportUrl);
  exportUrl=null;$('#export-result')?.remove();
}
function supportsImageShare(file){
  try{return !!navigator.share && !!navigator.canShare?.({files:[file]});}catch{return false;}
}
async function shareExport(){
  if(!exportFile)return;
  const file=exportFile,button=$('#share-image');
  if(button)button.disabled=true;
  try{
    await navigator.share({files:[file],title:siteConfig.name+' · 选购清单'});
  }catch(error){
    if(error.name!=='AbortError')toast('此浏览器暂时无法分享，请长按下方图片保存到相册');
  }finally{if(button)button.disabled=false;}
}
async function exportImage(){
  const exportCart=cart.map(item=>({...item}));
  const hasDemo=exportCart.some(item=>products.find(p=>p.id===item.id)?.demo!==false);
  const button=$('#export-image');button.disabled=true;button.textContent='正在生成…';
  try{
    const snapshot=JSON.stringify(exportCart);
    if(exportCart.length>95)throw new Error('清单较长，请分批生成图片');
    const photos=[];
    for(let offset=0;offset<exportCart.length;offset+=3){
      photos.push(...await Promise.all(exportCart.slice(offset,offset+3).map(async item=>{
      const p=products.find(p=>p.id===item.id),path=cartPhoto(p,item.variant);
      if(!path)return null;
      try{return await loadPhoto(path,8000,'thumb');}catch{throw new Error(p.name+'（'+item.variant+'）照片加载失败，请检查网络后重试');}
      })));
    }
    const qrImages=await loadBrandQrs();
    const footerArtwork=await loadBrandFooter();
    await document.fonts.ready;
    if(JSON.stringify(cart)!==snapshot)throw new Error('清单已变化，请重新生成图片');
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=(footerArtwork?900:qrImages.length?1500:1050)+exportCart.length*155;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#343b32';ctx.font='32px sans-serif';const title=siteConfig.name+' · 选购清单';const titleWidth=ctx.measureText(title).width;if(titleWidth>800)ctx.font=Math.max(18,Math.floor(32*800/titleWidth))+'px sans-serif';ctx.fillText(title,50,70);ctx.font='17px sans-serif';ctx.fillStyle='#7e836f';ctx.fillText(brandConfig.englishName+' / COLLECTION',50,110);ctx.fillText(hasDemo?'含演示商品 · 选购意向，非正式订单':'选购意向，非正式订单',50,155);
    for(let index=0;index<exportCart.length;index++){const i=exportCart[index],p=products.find(p=>p.id===i.id),y=205+index*155;ctx.fillStyle='#e9e3d7';ctx.fillRect(50,y,105,120);ctx.fillStyle='#858574';ctx.font='14px sans-serif';ctx.fillText('图片待上传',66,y+64);
      if(photos[index]){ctx.fillStyle='#e9e3d7';ctx.fillRect(50,y,105,120);drawPhoto(ctx,photos[index],50,y,105,120);}ctx.fillStyle='#343b32';ctx.font='24px sans-serif';ctx.fillText(p.name,180,y+30);ctx.font='19px sans-serif';ctx.fillStyle='#7e836f';ctx.fillText(`${i.variant} × ${i.quantity} · 单价¥${p.price}/${p.unit||'件'}`,180,y+68);ctx.fillStyle='#343b32';ctx.fillText(`¥${p.price*i.quantity}`,690,y+65);ctx.strokeStyle='#deded3';ctx.beginPath();ctx.moveTo(50,y+140);ctx.lineTo(850,y+140);ctx.stroke();}
    const y=230+exportCart.length*155;ctx.fillStyle='#343b32';ctx.font='26px sans-serif';ctx.fillText(`参考合计：¥${total(exportCart).toFixed(2)}`,50,y+30);ctx.fillStyle='#7e836f';ctx.font='17px sans-serif';ctx.fillText('请与店主确认库存、运费及最终价格。',50,y+80);ctx.fillText('图片仅供选款参考，本清单不包含支付功能。',50,y+110);
    brandFooter(ctx,y,qrImages,brandConfig,footerArtwork);
    ctx.fillStyle='#244d3e';ctx.font='20px sans-serif';let storeY=footerArtwork?y+415:y+830;
    for(const line of storeLines()){ctx.fillText(line,50,storeY);storeY+=31;}
    ctx.font='17px sans-serif';ctx.fillText(siteConfig.relationship,50,storeY+4);ctx.fillText(siteConfig.headline,50,storeY+34);
    ctx.fillText('两位线上客服均服务两家门店，添加不成功可联系另一位。',50,storeY+65);
    if(brandConfig.showWebsiteUrl && brandConfig.websiteUrl)ctx.fillText(brandConfig.websiteUrl,50,storeY+95);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('图片生成失败，请重试');
    if(JSON.stringify(cart)!==snapshot)throw new Error('清单已变化，请重新生成图片');
    clearExport();exportFile=new File([blob],siteConfig.name+'-选购清单.png',{type:'image/png'});
    // A data URL survives browser long-press saving better than a short-lived blob URL.
    exportUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片生成失败'));reader.readAsDataURL(blob);});
    if(JSON.stringify(cart)!==snapshot){clearExport();throw new Error('清单已变化，请重新生成图片');}
    const shareable=supportsImageShare(exportFile);
    const result=document.createElement('section');result.id='export-result';
    result.innerHTML=`<h3>图片清单已生成</h3><p class="save-image-hint"><strong>长按下方图片 → 保存到相册</strong><br>也可点击分享，将完整清单发送给微信客服。</p><div class="list-actions">${shareable?'<button class="primary" id="share-image">分享图片／保存到相册</button>':''}<a class="secondary" id="download-image" download="${escapeHTML(siteConfig.name)}-选购清单.png">下载图片</a></div><img id="export-preview" alt="完整选购清单，长按可保存">`;
    $('#list-dialog .list-content').append(result);
    $('#export-preview').src=exportUrl;$('#download-image').href=exportUrl;
    result.scrollIntoView({block:'start'});
    if(shareable){
      // Do not lose the required user gesture: retry button invokes share synchronously.
      if(navigator.userActivation?.isActive)await shareExport();
      else toast('图片已生成，点击分享图片即可发送或保存');
    }else{
      toast('图片已生成，请长按下方图片保存到相册');
    }
  }catch(error){toast(error.message || '图片生成失败，请重试或复制文字清单');}finally{button.disabled=false;button.textContent='分享／保存图片清单';}

}
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-close]'))dialog.close();});
renderProducts();updateCount();

function homeImage(path,alt,{hero=false}={}){
 const dims=photoDimensions(path,hero?'detail':'card');
 const img=`<img ${dims?`width="${dims.width}" height="${dims.height}"`:''} class="home-photo" src="${photoUrl(path,hero?'detail':'card')}" srcset="${photoSrcset(path,hero?'detail':'card')}" sizes="${hero?'(max-width:760px) 94vw, 1120px':'(max-width:760px) 31vw, 340px'}" alt="${escapeHTML(alt)}" loading="${hero?'eager':'lazy'}" ${hero?'fetchpriority="high"':''} decoding="async" data-fallback="${photoUrl(path,'original')}">`;
 // Cap phone hero bandwidth even on high-DPR screens; gallery detail remains full resolution.
 return hero?`<picture><source media="(max-width:760px)" srcset="${photoUrl(path,'card')}">${img}</picture>`:img;
}
function selectHomeCategory(name){category=name;query='';$('#search').value='';visibleLimit=24;renderProducts();$('#collection').scrollIntoView({behavior:'smooth'});}
let storeIndex=0;
function renderStore(){const s=siteConfig.stores[storeIndex];$('#home-hero-photo').innerHTML=s.photo?homeImage(s.photo,s.location+'｜'+s.name+' · 实拍',{hero:true}):`<div class="store-photo-pending" role="img" aria-label="${s.location}真实照片待提供"><strong>${s.location}｜${s.name}</strong><span>真实店铺照片待提供</span></div>`;$('#store-caption').textContent=s.location+'｜'+s.name;$('#store-dots').innerHTML=siteConfig.stores.map((s,i)=>`<button data-store-index="${i}" aria-label="查看${s.location}｜${s.name}" aria-pressed="${i===storeIndex}"><span aria-hidden="true">${i===storeIndex?'●':'○'}</span><span><b>${s.location}</b><small>${s.name}</small></span></button>`).join('');}
function moveStore(delta){storeIndex=(storeIndex+delta+siteConfig.stores.length)%siteConfig.stores.length;renderStore();}
$('#home-hero-photo').tabIndex=0;
$('#store-carousel').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();moveStore(e.key==='ArrowRight'?1:-1);$('#store-dots [aria-pressed=true]').focus({preventScroll:true});}});
$('#store-carousel').addEventListener('click',e=>{const dot=e.target.closest('[data-store-index]');if(dot){storeIndex=Number(dot.dataset.storeIndex);renderStore();}if(e.target.closest('[data-store-prev]'))moveStore(-1);if(e.target.closest('[data-store-next]'))moveStore(1);});
let storeTouch=null;$('#home-hero-photo').addEventListener('touchstart',e=>{storeTouch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});$('#home-hero-photo').addEventListener('touchend',e=>{if(!storeTouch||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-storeTouch.x,dy=e.changedTouches[0].clientY-storeTouch.y;storeTouch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)moveStore(dx<0?1:-1);},{passive:true});$('#home-hero-photo').addEventListener('touchcancel',()=>{storeTouch=null;});renderStore();
$('#home-category-grid').innerHTML=homeConfig.categories.map(c=>`<button class="home-category" data-home-category="${escapeHTML(c.name)}">${homeImage(c.photo,c.name+' · 门店实拍')}<span>${escapeHTML(c.name)}</span></button>`).join('')+`<button class="home-category store-tile" data-open-store>${homeImage(homeConfig.storefront,'八廓街店｜加西得了个鸭门头实拍')}<span>两家小店 →</span></button>`;
$('#home-feature-grid').innerHTML=homeConfig.featuredIds.map(id=>{const p=products.find(p=>p.id===id);return p?`<button class="home-feature" data-feature-product="${id}">${homeImage(p.coverImage,p.name+' · 实拍展示')}<span>${escapeHTML(p.name)} <span>¥${p.price}/个</span></span></button>`:'';}).join('');
document.addEventListener('click',e=>{
 const c=e.target.closest('[data-home-category]');if(c)selectHomeCategory(c.dataset.homeCategory);
 const p=e.target.closest('[data-feature-product]');if(p)openDetail(p.dataset.featureProduct);
 if(e.target.closest('[data-show-all]'))selectHomeCategory(categories[0]);
 if(e.target.closest('[data-open-list]'))$('#open-list').click();
 if(e.target.closest('[data-open-contact]'))openContacts();
 if(e.target.closest('[data-open-store]')){$('#store-photo').innerHTML=siteConfig.stores.map(s=>`<section><h3>${s.location}｜${s.name}</h3>${s.photo?homeImage(s.photo,s.location+'真实门头',{hero:true}):'<p class="store-photo-pending">真实照片待提供</p>'}${s.id==='street'?'<h4>八廓街店店内实拍</h4>'+homeImage(homeConfig.hero,'八廓街店店内实拍',{hero:true}):''}</section>`).join('');$('#store-dialog').showModal();}
});
$('#store-dialog').addEventListener('click',e=>{if(e.target===$('#store-dialog')||e.target.closest('[data-close]'))$('#store-dialog').close();if(e.target.closest('[data-store-contact]')){$('#store-dialog').close();openContacts();}});

// Reserve the measured fixed navigation footprint, including iPhone safe area.
let viewportFrame=0;
function syncViewport(){
 const root=document.documentElement,nav=document.querySelector('.bottom-nav');
 const values={'--visual-viewport-height':Math.round(window.visualViewport?.height||innerHeight)+'px','--bottom-nav-height':Math.ceil(nav?.getBoundingClientRect().height||50)+'px'};
 for(const [key,value]of Object.entries(values))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
}
function scheduleViewport(){if(viewportFrame)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;syncViewport();});}
window.addEventListener('resize',scheduleViewport,{passive:true});
window.visualViewport?.addEventListener('resize',scheduleViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',scheduleViewport,{passive:true});
const bottomNav=document.querySelector('.bottom-nav');
if(typeof ResizeObserver!=='undefined' && bottomNav){const observer=new ResizeObserver(scheduleViewport);try{observer.observe(bottomNav,{box:'border-box'});}catch{observer.observe(bottomNav);}}
syncViewport();
