import {create} from 'fontkit';
import {readFile} from 'node:fs/promises';
import {brandConfig,validateBrand} from '../src/brand.js';
export function adaptiveInk(luminance,config=brandConfig){return config.imageWatermark.adaptiveColor && luminance<0.5?config.imageWatermark.lightColor:config.imageWatermark.darkColor;}
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let font;
async function getFont(){return font ||= create(await readFile(new URL('../assets/fonts/NotoSansCJKsc-Light.woff2',import.meta.url)));}
export async function watermarkSvg(width,color,config=brandConfig,index=0){
  validateBrand(config);const face=await getFont();
  const first=width*0.53*(100/520)*config.imageWatermark.fontScale;
  const service=config.customerServices[index%config.customerServices.length];
  const lines=[{text:config.name,size:first},{text:service?'微信：'+service.wechatId:'',size:first*0.58}].filter(line=>line.text);
  const shapes=[];let baseline=first,maxWidth=0;
  for(const line of lines){
    const run=face.layout(line.text),scale=line.size/face.unitsPerEm;
    let x=0;
    run.glyphs.forEach((glyph,i)=>{
      if(!glyph.id)throw new Error('水印字体不包含字符，请更换支持该字符的开源字体');
      const position=run.positions[i];
      shapes.push(`<path d="${glyph.path.toSVG()}" transform="translate(${x+position.xOffset*scale},${baseline-position.yOffset*scale}) scale(${scale},${-scale})"/>`);
      x+=position.xAdvance*scale;
    });
    maxWidth=Math.max(maxWidth,x);baseline+=line.size*1.45;
  }
  const w=Math.ceil(maxWidth+first*0.15),h=Math.ceil(baseline-first*0.15);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g fill="${xml(color)}" opacity="${config.imageWatermark.opacity}">${shapes.join('')}</g></svg>`);
}
