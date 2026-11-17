// Only uploaded same-site raster photos are accepted. Never borrow another variant's photos.
export function photoPath(value) {
  if (typeof value !== 'string') return null;
  const path=value.replace(/^\/+/, '');
  return /^public\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(path) && !path.includes('..') ? path : null;
}
function photoList(value) { return Array.isArray(value) ? [...new Set(value.map(photoPath).filter(Boolean))] : []; }
export function publicPhotos(product) {
  const photos=photoList(product.images);
  return photos.length ? photos : photoList([product.image]);
}
export function productGallery(product, variant) {
  const common=publicPhotos(product);
  const own=product.variants?.includes(variant) && Object.hasOwn(product.variantImages || {}, variant)
    ? photoList(product.variantImages[variant]) : [];
  return {photos:[...new Set([...own,...common])], generic:!!variant && !own.length && !!common.length};
}
export function cartPhoto(product, variant) { return productGallery(product,variant).photos[0] || null; }
// Standalone builds embed original photos so file:// previews also work on phones.
export function photoUrl(path) {
  if (!photoPath(path)) throw new Error('Invalid photo path');
  return typeof embeddedPhotos !== 'undefined' && embeddedPhotos[path] || './'+path;
}
export async function loadPhoto(path, timeout=8000) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const finish=(error)=>{clearTimeout(timer);image.onload=null;image.onerror=null;error ? reject(error) : resolve(image);};
    const timer=setTimeout(()=>finish(new Error('Photo timeout')),timeout);
    image.onload=async()=>{try{if(image.decode)await image.decode();finish();}catch(error){finish(error);}};image.onerror=()=>finish(new Error('Photo unavailable'));
    image.src=photoUrl(path);
  });
}
export function drawPhoto(ctx, image, x, y, width, height) {
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);
}
