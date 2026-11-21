// Confirmed homepage assets; originals live only in .private-originals/homepage.
export const homeConfig = {
 hero:'public/images/homepage/hero.jpg',storefront:'public/images/homepage/storefront.jpg',
 featuredIds:['soft-lamb','rainbow-lamb'],
 categories:[
  {name:'随手带走的小物',photo:'public/images/homepage/takeaways.jpg',legacy:['随身饰物']},
  {name:'羊毛毡生活好物',photo:'public/images/homepage/felt.jpg',legacy:[]},
  {name:'尼泊尔与藏地手作',photo:'public/images/homepage/handcrafts.jpg',legacy:[]},
  {name:'尼泊尔传统手工制品',photo:'public/images/homepage/traditional.jpg',legacy:[]},
  {name:'藏地旅行纪念',photo:'public/images/homepage/souvenirs.jpg',legacy:['纸间心意']},
  {name:'手串与饰品',photo:'public/images/homepage/jewelry.jpg',legacy:['随身饰物']},
  {name:'织物与穿戴',photo:'public/images/homepage/textiles.jpg',legacy:['织物布艺']},
 ],
};
export const homeSources=Object.fromEntries([homeConfig.hero,homeConfig.storefront,...homeConfig.categories.map(c=>c.photo)].map(path=>[path,{
 // Opaque irreversible masks are applied before resize/watermark. Normalized coordinates.
 masks:path.endsWith('/hero.jpg')?[[1474/1536,373/1152,36/1536,40/1152],[1475/1536,451/1152,36/1536,40/1152],[1487/1536,598/1152,49/1536,41/1152],[178/1536,698/1152,28/1536,40/1152],[183/1536,758/1152,32/1536,39/1152],[201/1536,746/1152,26/1536,37/1152],[230/1536,733/1152,26/1536,33/1152],[373/1536,759/1152,91/1536,28/1152],[0,1013/1152,175/1536,49/1152]]:path.endsWith('/storefront.jpg')?[[.718,.67,.045,.22],[.338,.865,.035,.10]]:[],
 refinement:path.endsWith('/hero.jpg')?{version:'hero-refinement-v1',sourceQuad:[[0,45/1151],[1,8/1151],[1480/1535,1115/1151],[45/1535,1150/1151]],width:1480,height:1104,centerY:.59,ratios:{thumb:1.94,card:1.94,detail:2.15},brightness:1.025,whiteBalance:[1,1,1.004],sharpenSigma:.35,feather:12}:null,
 crop:path.endsWith('/jewelry.jpg')?[.77,.16,.23,.56]:null,
}]));
// Mall original is preserved as PNG; the private .jpg pipeline alias has identical bytes.
homeSources['public/images/stores/barkhor-mall.jpg']={masks:[],refinement:null,crop:null};
export function categoryMatches(product,category){
 if(category==='全部好物')return true;
 return product.category===category || !!homeConfig.categories.find(c=>c.name===category)?.legacy.includes(product.category);
}
