// Customer-facing identity and store facts, separate from immutable artwork recipes.
export const siteConfig={
 name:'扎西德勒鸭·藏地选物',
 headline:'把喜欢的藏地，带回日常。',
 subtitle:'两家藏地文创小店，一份熟悉的喜欢。',
 relationship:'两家实体店 · 同一经营团队 · 商品与售价统一',
 visual:{pageWatermarkOpacity:0.028},
 exportWatermark:{opacity:0.055,angle:-25,rowGap:210,columnGap:310,color:'#244d3e'},
 customerMode:'equal',
 contactHint:'两位线上客服均服务两家门店。任选一位联系，添加不成功可联系另一位。',
 stores:[
  {id:'mall',location:'八廓商场店',name:'扎西德勒鸭',photo:'public/images/stores/barkhor-mall.jpg',privatePhotoPath:'.private-originals/stores/barkhor-mall.jpg',publicPhotoPath:'public/images/stores/barkhor-mall.jpg'},
  {id:'street',location:'八廓街店',name:'加西得了个鸭',photo:'public/images/homepage/storefront.jpg'},
 ],
};
export function onlineServices(config,site=siteConfig){return config.customerServices;}
export function storeLines(site=siteConfig){return site.stores.map(s=>s.location+'｜'+s.name);}
export function validateSite(site,brand){
 if(site.name!=='扎西德勒鸭·藏地选物')throw Error('网站名称须保持确认的正式名称');
 if(site.customerMode!=='equal' || brand.customerServices.length!==2)throw Error('本版本保持两位平等线上客服');
 if(site.stores.length!==2 || site.stores[0].id!=='mall' || site.stores[1].id!=='street')throw Error('双店顺序不正确');
 return site;
}
