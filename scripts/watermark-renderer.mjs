import {create} from 'fontkit';
import {readFile} from 'node:fs/promises';
import {brandConfig,validateBrand,mountainGeometry} from '../src/brand.js';
export function adaptiveInk(luminance,config=brandConfig){return config.imageWatermark.adaptiveColor && luminance<0.5?config.imageWatermark.lightColor:config.imageWatermark.darkColor;}
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
export async function watermarkSvg(width,color,config=brandConfig,index=0){
  validateBrand(config);const face=await getFont(config.imageWatermark.fontAssetPath),serif=await getFont(config.brandVisual.fontAssetPath);
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
  const name=fitGlyphs(face,config.name,width*params.nameSizeRatio,config.brandVisual.letterSpacing,width*0.94);
  const english=fitGlyphs(face,config.englishName,width*params.englishSizeRatio,config.brandVisual.letterSpacing*1.7,width*0.88);
  const subtitle=fitGlyphs(face,config.subtitle,width*params.subtitleSizeRatio,config.brandVisual.letterSpacing*0.6,width*0.68);
  const body=`<g color="${xml(color)}" fill="${xml(color)}" stroke="${contrastOutline(color)}" stroke-width="${Math.max(0.25,width*0.0012)}" paint-order="stroke fill" stroke-linejoin="round" opacity="${params.opacity}">${mountain(width*0.6,width/2,0,config)}${centered(name,width/2,width*0.33)}${centered(english,width/2,width*0.415)}${centered(subtitle,width/2,width*0.515)}<path d="M${width*0.04} ${width*0.495}H${width*0.14} M${width*0.86} ${width*0.495}H${width*0.96}" stroke="${xml(color)}" stroke-width="${width*0.0015}" fill="none"/></g>`;
  return svg(width,width*0.56,body,[config.name,config.englishName,config.subtitle].join(' | '));
}
export async function signatureSvg(width,height,config=brandConfig){
  validateBrand(config);const face=await getFont(config.brandVisual.fontAssetPath),params=config.brandVisual.footer;
  const name=glyphs(face,config.name+' · '+config.englishName,width*0.014,config.brandVisual.letterSpacing*0.3);
  const contacts=config.customerServices.map(service=>fitGlyphs(face,service.label+'微信：'+service.wechatId,width*params.fontSizeRatio,params.letterSpacing,width*0.44));
  const ruleY=height*0.25,mountainW=Math.min(width*0.14,height*1.3);
  let body=`<rect width="${width}" height="${height}" fill="${params.background}"/><g color="${params.color}" fill="${params.color}" opacity="${params.opacity}"><path d="M${width*0.04} ${ruleY}H${width*0.40} M${width*0.60} ${ruleY}H${width*0.96}" fill="none" stroke="${params.color}" stroke-width="${Math.max(0.25,width*params.lineWidthRatio)}"/>${mountain(mountainW,width/2,0,config)}${centered(name,width/2,height*0.58)}`;
  contacts.forEach((line,index)=>{body+=centered(line,width*(config.customerServices.length===1?0.5:index===0?0.26:0.74),height*0.87);});
  if(contacts.length>1)body+=`<path d="M${width/2} ${height*0.70}V${height*0.94}" stroke="${params.color}" stroke-width="${Math.max(0.25,width*params.lineWidthRatio)}"/>`;
  body+='</g>';
  return svg(width,height,body,[config.name,config.englishName,...config.customerServices.map(service=>service.wechatId)].join(' | '));
}
