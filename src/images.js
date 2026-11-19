import {homepagePhotos} from './generated-homepage-images.js';
import {optimizedPhotos} from './generated-images.js';
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
// Standalone previews embed one detail rendition per original; normal pages use size-specific files.
export function photoUrl(path, size='detail') {
  if (!photoPath(path)) throw new Error('Invalid photo path');
  if(typeof embeddedPhotos !== 'undefined' && embeddedPhotos[path])return embeddedPhotos[path];
  const entry=optimizedPhotos[path] || homepagePhotos[path];
  return './'+(entry?.[size]?.path || entry?.public?.path || path);
}
export function photoSrcset(path, size='detail') {
  if(typeof embeddedPhotos !== 'undefined')return '';
  const entry=optimizedPhotos[path] || homepagePhotos[path];
  if(!entry)return '';
  return [...new Map((size==='card'?['thumb','card']:['card','detail']).map(size=>[entry[size].width,`${photoUrl(path,size)} ${entry[size].width}w`])).values()].join(', ');
}
const decodedPhotos=new Map();
const MAX_PHOTOS=8, MAX_BYTES=24*1024*1024;
function trimPhotos(){
  let bytes=[...decodedPhotos.values()].reduce((sum,entry)=>sum+(entry.bytes || 0),0);
  for(const [key,entry] of decodedPhotos){
    if(decodedPhotos.size<=MAX_PHOTOS && bytes<=MAX_BYTES)break;
    if(entry.bytes){decodedPhotos.delete(key);bytes-=entry.bytes;}
  }
}
export function clearPhotoCache(){decodedPhotos.clear();}
export function loadPhoto(path, timeout=8000, size='detail') {
  const url=photoUrl(path,size);
  if(decodedPhotos.has(url)){
    const cached=decodedPhotos.get(url);decodedPhotos.delete(url);decodedPhotos.set(url,cached);return cached.promise;
  }
  // At most eight pending/decoded entries are retained; failures can be retried.
  if(decodedPhotos.size>=MAX_PHOTOS)decodedPhotos.delete(decodedPhotos.keys().next().value);
  const entry={bytes:0};
  entry.promise=new Promise((resolve,reject)=>{
    const image=new Image();let settled=false,retried=false;
    const finish=(error)=>{
      if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;
      if(error){if(decodedPhotos.get(url)===entry)decodedPhotos.delete(url);reject(error);}
      else{entry.bytes=(image.naturalWidth || 1)*(image.naturalHeight || 1)*4;trimPhotos();resolve(image);}
    };
    const timer=setTimeout(()=>finish(new Error('Photo timeout')),timeout);
    image.onload=async()=>{try{if(image.decode)await image.decode();finish();}catch(error){finish(error);}};
    image.onerror=()=>{
      const fallback=photoUrl(path,'original');
      if(!retried && fallback!==url){retried=true;image.src=fallback;}
      else finish(new Error('Photo unavailable'));
    };image.src=url;
  });
  decodedPhotos.set(url,entry);return entry.promise;
}
export function preloadPhotos(paths, connection=globalThis.navigator?.connection) {
  if(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''))return Promise.resolve();
  return [...new Set(paths.filter(Boolean))].slice(0,2).reduce((chain,path)=>chain.then(()=>loadPhoto(path).catch(()=>{})),Promise.resolve());
}
export function drawPhoto(ctx, image, x, y, width, height) {
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);
}
