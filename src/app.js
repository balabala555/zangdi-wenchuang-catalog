import {categories,products} from './data.js';
import {sanitizeCart,total,listText} from './cart.js';
const $=s=>document.querySelector(s);
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function imageMarkup(p, className='') {
  const placeholder=`<div class="image-placeholder ${className}" role="img" aria-label="${escapeHTML(p.name)}，商品图片待上传"><span class="placeholder-symbol" aria-hidden="true">＋</span><strong>商品图片待上传</strong><small>临时占位 · 非商品实拍</small></div>`;
  if (!p.image) return placeholder;
  // Relative, same-site images keep subdirectory deployments working.
  const path=p.image.replace(/^\/+/, '');
  if (!/^public\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(path) || path.includes('..')) return placeholder;
  return `<div class="photo-frame ${className}"><img src="./${path}" alt="${escapeHTML(p.name)}" loading="lazy">${placeholder}</div>`;
}
// A failed real-image request falls back to a labelled placeholder without a broken icon.
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement){e.target.hidden=true;e.target.parentElement.classList.add('image-failed');}},true);
let cart=[];
try {cart=sanitizeCart(JSON.parse(localStorage.getItem('shan-cart')||'[]'));} catch {}
let category=categories[0], query='', selected=null, variant='', quantity=1, toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function save(){try{localStorage.setItem('shan-cart',JSON.stringify(cart));}catch{toast('浏览器无法保存清单，关闭页面后可能丢失');}updateCount();}
function updateCount(){$('#bag-count').textContent=cart.reduce((n,i)=>n+i.quantity,0);}
function renderProducts(){
  $('#categories').innerHTML=categories.map(c=>`<button class="${c===category?'active':''}" aria-pressed="${c===category}" data-category="${c}">${c}</button>`).join('');
  const shown=products.filter(p=>(category===categories[0]||p.category===category)&&`${p.name}${p.subtitle}${p.category}`.includes(query));
  $('#results-count').textContent=`共 ${shown.length} 件好物`;
  $('#empty').hidden=shown.length>0;
  $('#products').innerHTML=shown.map(p=>`<button class="product-card" data-product="${p.id}" aria-label="查看${p.name}详情"><div class="product-image">${imageMarkup(p)}<span class="tag">${p.tag}</span></div><div class="product-info"><span class="product-category">${p.category}</span><div class="product-title"><h3>${p.name}</h3><span class="price">¥ ${p.price.toFixed(2)}</span></div><p>${p.subtitle}</p></div></button>`).join('');
}
$('#categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;renderProducts();}});
$('#search').addEventListener('input',e=>{query=e.target.value.trim();renderProducts();});
$('#products').addEventListener('click',e=>{const b=e.target.closest('[data-product]');if(b)openDetail(b.dataset.product);});
function openDetail(id){selected=products.find(p=>p.id===id);variant=selected.variants[0];quantity=1;renderDetail();$('#detail').showModal();}
function renderDetail(){const p=selected;$('#detail').innerHTML=`<button class="close" data-close aria-label="关闭商品详情">×</button><div class="detail-layout">${imageMarkup(p,'detail-image')}<div class="detail-copy"><span class="eyebrow">${p.category} / DEMO COLLECTION</span><h2 id="detail-title">${p.name}</h2><span class="price">¥ ${p.price.toFixed(2)}</span><p>${p.description}</p><div class="specs">材质：${p.material}<br>规格：${p.size}</div><span class="variant-label">选择款式 <span class="small-note">（商品图片待上传）</span></span><div class="variants">${p.variants.map(v=>`<button data-variant="${v}" class="${v===variant?'active':''}" aria-pressed="${v===variant}">${v}</button>`).join('')}</div><div class="add-row"><div class="quantity"><button data-delta="-1" aria-label="减少数量" ${quantity===1?'disabled':''}>−</button><span aria-live="polite">${quantity}</span><button data-delta="1" aria-label="增加数量" ${quantity===99?'disabled':''}>+</button></div><button class="primary" id="add-cart">加入选购清单</button></div><p class="small-note">演示商品 · 加入清单不代表下单，无需支付</p></div></div>`;}
$('#detail').addEventListener('click',e=>{
  const v=e.target.closest('[data-variant]'),d=e.target.closest('[data-delta]');
  if(v){variant=v.dataset.variant;$('#detail .variants').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===v);b.setAttribute('aria-pressed',b===v);});}
  if(d){quantity=Math.max(1,Math.min(99,quantity+Number(d.dataset.delta)));const buttons=$('#detail .quantity').querySelectorAll('button');$('#detail .quantity span').textContent=quantity;buttons[0].disabled=quantity===1;buttons[1].disabled=quantity===99;}
  if(e.target.closest('#add-cart')){const old=cart.find(i=>i.id===selected.id&&i.variant===variant);if(old)old.quantity=Math.min(99,old.quantity+quantity);else cart.push({id:selected.id,variant,quantity});save();$('#detail').close();toast('已加入清单，喜欢的好物已为你记下');}
});
function renderList(){
  $('#list-dialog').innerHTML=`<div class="list-content"><button class="close" data-close aria-label="关闭选购清单">×</button><p class="eyebrow">YOUR LITTLE COLLECTION</p><h2 id="list-title">我的选购清单</h2><p class="small-note">先收集喜欢，再与店主确认。清单仅保存在当前浏览器。</p>${cart.length?cart.map((i,index)=>{const p=products.find(p=>p.id===i.id);return `<article class="list-item">${imageMarkup(p,'list-thumbnail')}<div class="list-item-info"><h3>${p.name}</h3><p>${i.variant} · ¥${p.price.toFixed(2)} / 件</p><div class="quantity"><button data-index="${index}" data-change="-1" aria-label="减少${p.name}数量" ${i.quantity===1?'disabled':''}>−</button><span>${i.quantity}</span><button data-index="${index}" data-change="1" aria-label="增加${p.name}数量" ${i.quantity===99?'disabled':''}>+</button></div><button class="remove" data-remove="${index}">移除</button></div><span class="price">¥${p.price*i.quantity}</span></article>`;}).join('')+`<div class="list-total"><span>参考合计</span><strong>¥ ${total(cart).toFixed(2)}</strong></div><p class="small-note">不含运费；库存、运费与成交价格请联系店主确认。当前为演示商品。</p><div class="list-actions"><button class="primary" id="export-image">保存图片清单</button><button class="secondary" id="copy-list">复制文字清单</button></div><p class="small-note">可将清单发给店主；微信内若无法下载图片，可复制文字或截图发送。</p>`:'<div class="empty">清单还是空的。<br>去挑一件让你心动的好物吧。<br><button class="secondary" data-close>继续逛逛</button></div>'}</div>`;
}
$('#open-list').addEventListener('click',()=>{renderList();$('#list-dialog').showModal();});
$('#list-dialog').addEventListener('click',async e=>{
  const change=e.target.closest('[data-change]'),remove=e.target.closest('[data-remove]');
  if(change){const i=cart[Number(change.dataset.index)];i.quantity=Math.max(1,Math.min(99,i.quantity+Number(change.dataset.change)));save();renderList();}
  if(remove){cart.splice(Number(remove.dataset.remove),1);save();renderList();}
  if(e.target.closest('#copy-list')){try{await navigator.clipboard.writeText(listText(cart));toast('清单已复制，可粘贴发送给店主');}catch{let area=$('#copy-fallback');if(!area){area=document.createElement('textarea');area.id='copy-fallback';area.className='copy-fallback';area.readOnly=true;area.setAttribute('aria-label','请长按复制选购清单');$('#list-dialog .list-content').append(area);}area.value=listText(cart);area.focus();area.select();toast('请长按或手动复制下方文字');}}
  if(e.target.closest('#export-image'))await exportImage();
});
async function exportImage(){
  const button=$('#export-image');button.disabled=true;button.textContent='正在生成…';
  try{
    await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=270+cart.length*155+160;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#343b32';ctx.font='32px sans-serif';ctx.fillText('山间来信 · 选购清单',50,70);ctx.font='17px sans-serif';ctx.fillStyle='#7e836f';ctx.fillText('LETTERS FROM TIBET / DEMO COLLECTION',50,110);ctx.fillText('演示商品 · 选购意向，非正式订单',50,155);
    for(let index=0;index<cart.length;index++){const i=cart[index],p=products.find(p=>p.id===i.id),y=205+index*155;ctx.fillStyle='#e9e3d7';ctx.fillRect(50,y,105,120);ctx.fillStyle='#858574';ctx.font='14px sans-serif';ctx.fillText('图片待上传',66,y+64);
      if(p.image && /^\/?public\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(p.image) && !p.image.includes('..')){try{const img=new Image();img.src='./'+p.image.replace(/^\/+/, '');await img.decode();ctx.drawImage(img,50,y,105,120);}catch{/* Preserve the labelled placeholder if a real image is unavailable. */}}ctx.fillStyle='#343b32';ctx.font='24px sans-serif';ctx.fillText(p.name,180,y+30);ctx.font='19px sans-serif';ctx.fillStyle='#7e836f';ctx.fillText(`${i.variant} × ${i.quantity}`,180,y+68);ctx.fillStyle='#343b32';ctx.fillText(`¥${p.price*i.quantity}`,690,y+65);ctx.strokeStyle='#deded3';ctx.beginPath();ctx.moveTo(50,y+140);ctx.lineTo(850,y+140);ctx.stroke();}
    const y=230+cart.length*155;ctx.fillStyle='#343b32';ctx.font='26px sans-serif';ctx.fillText(`参考合计：¥${total(cart).toFixed(2)}`,50,y+30);ctx.fillStyle='#7e836f';ctx.font='17px sans-serif';ctx.fillText('请与店主确认库存、运费及最终价格。',50,y+80);ctx.fillText('图片待上传，本清单不包含支付功能。',50,y+110);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('image');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='山间来信-选购清单.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('图片已生成；微信内可使用截图或文字清单');
  }catch{toast('图片生成失败，请复制文字清单或截图');}finally{button.disabled=false;button.textContent='保存图片清单';}
}
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('[data-close]'))dialog.close();});
renderProducts();updateCount();
