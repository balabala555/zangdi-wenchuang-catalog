import {create} from 'fontkit';
import {readFile} from 'node:fs/promises';
import {brandConfig,validateBrand} from '../src/brand.js';
export function adaptiveInk(luminance,config=brandConfig){return config.imageWatermark.adaptiveColor && luminance<0.5?config.imageWatermark.lightColor:config.imageWatermark.darkColor;}
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fonts=new Map();
async function getFont(config){
  const path=config.imageWatermark.fontAssetPath;
  if(!fonts.has(path))fonts.set(path,create(await readFile(new URL('../'+path,import.meta.url))));
  return fonts.get(path);
}
export function contrastOutline(color){
  const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
  const brightness=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  return brightness<128?'#ffffff':'#000000';
}

export async function watermarkSvg(width,color,config=brandConfig,index=0){
  validateBrand(config);const face=await getFont(config);
  const first=width*0.53*(100/520)*config.imageWatermark.fontScale;
  const service=config.customerServices[index%config.customerServices.length];
  const lines=[{text:config.name,size:first},{text:service?'微信：'+service.wechatId:'',size:first*0.58}].filter(line=>line.text);
  const shapes=[];let baseline=first,maxWidth=0,lastSize=first;
  for(const [lineIndex,line] of lines.entries()){
    if(lineIndex)baseline+=line.size*1.45;
    const run=face.layout(line.text),scale=line.size/face.unitsPerEm;
    let x=0;
    run.glyphs.forEach((glyph,i)=>{
      if(!glyph.id)throw new Error('水印字体不包含字符，请更换支持该字符的开源字体');
      const position=run.positions[i];
      shapes.push(`<path vector-effect="non-scaling-stroke" d="${glyph.path.toSVG()}" transform="translate(${x+position.xOffset*scale},${baseline-position.yOffset*scale}) scale(${scale},${-scale})"/>`);
      x+=position.xAdvance*scale;
    });
    maxWidth=Math.max(maxWidth,x);lastSize=line.size;
  }
  const w=Math.ceil(maxWidth+first*0.15),h=Math.ceil(baseline+lastSize*0.3+first*0.08);
  const strokeWidth=Math.max(config.imageWatermark.minOutlinePx,first*config.imageWatermark.outlineRatio);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g fill="${xml(color)}" stroke="${contrastOutline(color)}" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill" opacity="${config.imageWatermark.opacity}">${shapes.join('')}</g></svg>`);
}
