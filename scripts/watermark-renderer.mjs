import {create} from 'fontkit';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {brandConfig,validateBrand,mountainGeometry} from '../src/brand.js';
export function adaptiveInk(luminance,config=brandConfig){return config.imageWatermark.adaptiveColor && luminance<config.imageWatermark.adaptiveThreshold?config.imageWatermark.lightColor:config.imageWatermark.darkColor;}
export function visualInk(luminance,config=brandConfig){return luminance<0.5?config.brandVisual.lightColor:config.brandVisual.darkColor;}
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fonts=new Map();
async function getFont(path){
  if(!fonts.has(path))fonts.set(path,create(await readFile(new URL('../'+path,import.meta.url))));
  return fonts.get(path);
}
export function contrastOutline(color){const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722<128?'#ffffff':'#000000';}
function glyphs(face,text,size,spacing=0){
  const run=face.layout(text),scale=size/face.unitsPerEm;let x=0;const paths=[];
  run.glyphs.forEach((glyph,index)=>{
    if(!glyph.id)throw new Error('品牌字体缺少字符，请补充相应开源字形');
    const p=run.positions[index];paths.push(`<path vector-effect="non-scaling-stroke" d="${glyph.path.toSVG()}" transform="translate(${x+p.xOffset*scale},${-p.yOffset*scale}) scale(${scale},${-scale})"/>`);
    x+=p.xAdvance*scale+(index<run.glyphs.length-1?size*spacing:0);
  });
  return {paths:paths.join(''),width:x};
}
function fitGlyphs(face,text,size,spacing,maxWidth){
  const line=glyphs(face,text,size,spacing);
  return line.width>maxWidth?glyphs(face,text,size*maxWidth/line.width,spacing):line;
}
function centered(line,x,y){return `<g transform="translate(${x-line.width/2},${y})">${line.paths}</g>`;}
function mountain(width,x,y,config){
  const shape=config.brandVisual.mountain,scale=width/shape.width;
  return `<g transform="translate(${x-width/2},${y}) scale(${scale})" fill="none" stroke="currentColor" stroke-width="${shape.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${mountainGeometry(config)}</g>`;
}
function svg(width,height,body,title){return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}"><title>${xml(title)}</title>${body}</svg>`);}
export async function approvedAsset(key,config=brandConfig){
  const file=config.assets.files[key],bytes=await readFile(new URL('../'+file.path,import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('品牌素材校验失败，请核对后更新全局配置：'+key);
  return bytes;
}
const raster=(bytes,x,y,width,height)=>`<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${bytes.toString('base64')}"/>`;
export async function watermarkSvg(width,color,config=brandConfig,index=0){
  validateBrand(config);const face=await getFont(config.imageWatermark.fontAssetPath),serif=await getFont(config.brandVisual.fontAssetPath);
  if(config.assets?.enabled){
    const params=config.imageWatermark,w=width*0.22;
    const light=color===params.lightColor,key=light?'watermark-light':'watermark-dark';
    const logo=await approvedAsset(key,config),size=width*0.014;
    const service=config.customerServices[index%config.customerServices.length];
    const contact=fitGlyphs(face,service?'微信：'+service.wechatId:'',size,params.letterSpacing,w*0.94);
    const h=w*580/1220+size*1.7;
    return svg(w,h,`<g opacity="${params.opacity}">${raster(logo,0,0,w,w*580/1220)}<g fill="${xml(color)}" stroke="${contrastOutline(color)}" stroke-width="${params.minOutlinePx}" paint-order="stroke fill">${centered(contact,w/2,h-size*0.35)}</g></g>`,[config.name,service?.wechatId || ''].join(' | '));
  }
  const first=width*0.53*(100/520)*config.imageWatermark.fontScale,second=first*config.imageWatermark.contactSizeRatio;
  const service=config.customerServices[index%config.customerServices.length];
  const name=glyphs(serif,config.name,first,config.brandVisual.letterSpacing*0.6);
  const contact=glyphs(face,service?'微信：'+service.wechatId:'',second,config.imageWatermark.letterSpacing);
  const w=Math.max(name.width,contact.width)+first*0.3,h=first*2.2+second*1.7;
  const strokeWidth=Math.max(config.imageWatermark.minOutlinePx,first*config.imageWatermark.outlineRatio);
  const body=`<g color="${xml(color)}" fill="${xml(color)}" stroke="${contrastOutline(color)}" stroke-width="${strokeWidth}" paint-order="stroke fill" stroke-linejoin="round" opacity="${config.imageWatermark.opacity}">${mountain(first*3.2,w/2,0,config)}${centered(name,w/2,first*1.95)}${centered(contact,w/2,first*1.95+second*1.45)}</g>`;
  return svg(w,h,body,[config.name,service?.wechatId || ''].join(' | '));
}
export async function brandMarkSvg(width,color,config=brandConfig){
  validateBrand(config);const face=await getFont(config.brandVisual.fontAssetPath),params=config.brandVisual.mark;
  if(config.assets?.enabled){const key=color===config.brandVisual.lightColor?'logo-on-dark':'logo-color';return svg(width,width*0.60,`<g opacity="${params.opacity}">${raster(await approvedAsset(key,config),0,0,width,width*0.60)}</g>`,[config.name,config.englishName,config.subtitle].join(' | '));}
  const name=fitGlyphs(face,config.name,width*params.nameSizeRatio,config.brandVisual.letterSpacing,width*0.94);
  const english=fitGlyphs(face,config.englishName,width*params.englishSizeRatio,config.brandVisual.letterSpacing*1.7,width*0.88);
  const subtitle=fitGlyphs(face,config.subtitle,width*params.subtitleSizeRatio,config.brandVisual.letterSpacing*0.6,width*0.68);
  const body=`<g color="${xml(color)}" fill="${xml(color)}" stroke="${contrastOutline(color)}" stroke-width="${Math.max(0.25,width*0.0012)}" paint-order="stroke fill" stroke-linejoin="round" opacity="${params.opacity}">${mountain(width*0.6,width/2,0,config)}${centered(name,width/2,width*0.33)}${centered(english,width/2,width*0.425)}${centered(subtitle,width/2,width*0.55)}<path d="M${width*0.17} ${width*0.48}H${width*0.83}" stroke="${xml(color)}" stroke-width="${width*0.0015}" fill="none"/></g>`;
  return svg(width,width*0.60,body,[config.name,config.englishName,config.subtitle].join(' | '));
}
export async function signatureSvg(width,height,config=brandConfig){
  validateBrand(config);const face=await getFont(config.brandVisual.fontAssetPath),params=config.brandVisual.footer;
  if(config.assets?.enabled)return svg(width,height,raster(await approvedAsset('footer',config),0,0,width,height),[config.name,config.englishName,config.subtitle,...config.customerServices.map(service=>service.wechatId)].join(' | '));
  const name=fitGlyphs(face,config.name,width*params.nameSizeRatio,config.brandVisual.letterSpacing,width*0.32);
  const english=fitGlyphs(face,config.englishName,width*params.englishSizeRatio,0.35,width*0.32);
  const subtitle=fitGlyphs(face,config.subtitle,width*params.subtitleSizeRatio,0.2,width*0.30);
  const contacts=config.customerServices.map(service=>fitGlyphs(face,service.label+'微信：'+service.wechatId,width*params.fontSizeRatio,params.letterSpacing,width*0.29));
  // Paper band is appended outside the original photo; no color grading or product redraw.
  let body=`<rect width="${width}" height="${height}" fill="${params.background}"/><g color="${params.color}" fill="${params.color}" opacity="${params.opacity}">
    <path d="M${width*0.21} ${height*0.13}Q${width*0.29} ${-height*0.04} ${width*0.38} ${height*0.10}T${width*0.60} ${height*0.09}T${width*0.80} ${height*0.12}" fill="none" stroke="${params.color}" stroke-opacity="0.12" stroke-width="${width*0.003}"/>
    ${mountain(width*0.13,width*0.37,height*0.09,config)}${centered(name,width*0.37,height*0.43)}${centered(english,width*0.37,height*0.54)}
    <path d="M${width*0.54} ${height*0.24}V${height*0.50}" fill="none" stroke="${params.color}" stroke-width="${width*params.lineWidthRatio}"/>
    ${centered(subtitle,width*0.70,height*0.43)}`;
  contacts.forEach((line,index)=>{
    const x=width*(contacts.length===1?0.5:index===0?0.355:0.675);
    body+=`<rect x="${x-width*0.153}" y="${height*0.65}" width="${width*0.306}" height="${height*0.24}" rx="${width*0.006}" fill="none" stroke="${params.color}" stroke-opacity="0.3" stroke-width="${Math.max(0.3,width*params.lineWidthRatio)}"/>`+centered(line,x,height*0.81);
  });body+='</g>';
  if(params.showQrCodes){
    for(const [index,service] of config.customerServices.entries()){
      if(!service.qrCodePath)continue;
      // Embed uploaded bytes verbatim, including the entire original margin/header. Never redraw a QR.
      const bytes=await readFile(new URL('../'+service.qrCodePath,import.meta.url));
      const mime=/\.png$/i.test(service.qrCodePath)?'image/png':/\.webp$/i.test(service.qrCodePath)?'image/webp':'image/jpeg';
      const qrW=width*params.qrWidthRatio,qrH=height*0.82;
      const x=index===0?width*0.025:width*0.825;
      body+=`<image x="${x}" y="${height*0.09}" width="${qrW}" height="${qrH}" preserveAspectRatio="xMidYMid meet" href="data:${mime};base64,${bytes.toString('base64')}"/>`;
    }
  }
  return svg(width,height,body,[config.name,config.englishName,config.subtitle,...config.customerServices.map(service=>service.wechatId)].join(' | '));
}
