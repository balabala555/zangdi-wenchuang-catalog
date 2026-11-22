import {siteConfig,storeLines,onlineServices} from './site.js';
import {brandConfig,contactLines} from './brand.js';
import {products} from './data.js';
export function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  const result=[];
  for (const item of value) {
    const p=products.find(p=>p.id===item?.id);
    if (!p || !p.variants.includes(item.variant) || !Number.isInteger(item.quantity) || item.quantity<1) continue;
    const existing=result.find(r=>r.id===item.id && r.variant===item.variant);
    if(existing) existing.quantity=Math.min(99,existing.quantity+item.quantity);
    else result.push({id:item.id,variant:item.variant,quantity:Math.min(99,item.quantity)});
  }
  return result;
}
export function unitPrice(product,variant){const own=product?.variantPrices;if(own&&Object.hasOwn(own,variant)&&Number.isFinite(own[variant])&&own[variant]>0)return own[variant];return product?.price||0;}
export function lineTotal(product,variant,quantity){return Math.round(unitPrice(product,variant)*100)*quantity/100;}
export function total(cart) { return cart.reduce((sum,item)=>sum+Math.round(unitPrice(products.find(p=>p.id===item.id),item.variant)*100)*item.quantity,0)/100; }
export function listText(cart) { return [cart.some(item=>products.find(p=>p.id===item.id)?.demo!==false)?siteConfig.name+' · 选购清单（含演示商品）':siteConfig.name+' · 选购清单',...cart.map(item=>{const p=products.find(p=>p.id===item.id);return `${p.name} / ${item.variant} × ${item.quantity}  ¥${lineTotal(p,item.variant,item.quantity)}`;}),`参考合计：¥${total(cart)}`,'仅为选购意向，非订单；请与店主确认库存、运费及最终价格。',...storeLines(),...contactLines().slice(1).filter(line=>!brandConfig.customerServices.some(s=>line.includes(s.wechatId))||onlineServices(brandConfig).some(s=>line.includes(s.wechatId)))].join('\n'); }
