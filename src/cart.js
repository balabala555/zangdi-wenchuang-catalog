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
export function total(cart) { return cart.reduce((sum,item)=>sum+products.find(p=>p.id===item.id).price*item.quantity,0); }
export function listText(cart) { return [cart.some(item=>products.find(p=>p.id===item.id)?.demo!==false)?brandConfig.name+' · 选购清单（含演示商品）':brandConfig.name+' · 选购清单',...cart.map(item=>{const p=products.find(p=>p.id===item.id);return `${p.name} / ${item.variant} × ${item.quantity}  ¥${p.price*item.quantity}`;}),`参考合计：¥${total(cart)}`,'仅为选购意向，非订单；请与店主确认库存、运费及最终价格。',...contactLines().slice(1)].join('\n'); }
