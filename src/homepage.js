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
 masks:path.endsWith('/hero.jpg')?[[.945,.293,.055,.265],[.095,.56,.075,.15],[0,.87,.13,.06],[.23,.65,.08,.045]]:path.endsWith('/storefront.jpg')?[[.718,.67,.045,.22],[.338,.865,.035,.10]]:[],
 crop:path.endsWith('/jewelry.jpg')?[.77,.16,.23,.56]:null,
}]));
export function categoryMatches(product,category){
 if(category==='全部好物')return true;
 return product.category===category || !!homeConfig.categories.find(c=>c.name===category)?.legacy.includes(product.category);
}
