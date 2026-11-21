// Deterministic font paths over real pixels. No network, AI, raster text generation or source mutation.
import {brandConfig} from '../src/brand.js';
export const distributedTemplate={version:'distributed-brand-v1',position:'distributed',opacity:brandConfig.imageWatermark.opacity,angle:brandConfig.imageWatermark.angle,edge:1600,thumb:240,quality:86,fontRatio:.025,phoneRatio:brandConfig.imageWatermark.contactSizeRatio,positions:[[.23,.23],[.73,.42],[.25,.64],[.74,.83]]};
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function paths(face,text,size){const run=face.layout(text),scale=size/face.unitsPerEm;let advance=0;const shapes=[];for(let i=0;i<run.glyphs.length;i++){const glyph=run.glyphs[i],p=run.positions[i];if(!glyph.id)throw Error('Configured watermark glyph missing');shapes.push(`<path d="${glyph.path.toSVG()}" transform="translate(${advance+p.xOffset*scale},${-p.yOffset*scale}) scale(${scale},${-scale})"/>`);advance+=p.xAdvance*scale;}return {shapes:shapes.join(''),width:advance};}
export async function watermark(sharp,base,w,h,face,template){
 const fontSize=Math.min(Math.max(6,w*template.fontRatio),w*.06,h*.06),brand=paths(face,template.text,fontSize),groups=[],marks=[];
 for(const [i,[nx,ny]]of template.positions.entries()){
  const phone=paths(face,template.contacts[i%template.contacts.length],fontSize*template.phoneRatio),x=w*nx,y=h*ny,cw=Math.max(1,Math.min(w,Math.ceil(Math.max(brand.width,phone.width)))),ch=Math.max(1,Math.min(h,Math.ceil(fontSize*3))),left=Math.max(0,Math.min(w-cw,Math.floor(x-cw/2))),top=Math.max(0,Math.min(h-ch,Math.floor(y-ch/2)));
  const stats=await sharp(base).extract({left,top,width:cw,height:ch}).stats(),luma=stats.channels.slice(0,3).reduce((a,c,j)=>a+c.mean*[.2126,.7152,.0722][j],0)/255,ink=luma<brandConfig.imageWatermark.adaptiveThreshold?brandConfig.imageWatermark.lightColor:brandConfig.imageWatermark.darkColor,outline=luma<.55?'#30352c':'#ffffff';
  groups.push(`<g transform="translate(${x},${y}) rotate(${template.angle})" fill="${ink}" stroke="${outline}" stroke-width="${Math.max(.25,fontSize*.025)}" paint-order="stroke" opacity="${template.opacity}"><g transform="translate(${-brand.width/2},0)">${brand.shapes}</g><g transform="translate(${-phone.width/2},${fontSize*1.15})">${phone.shapes}</g></g>`);
  marks.push({x,y,fontSize,contact:template.contacts[i%template.contacts.length]});
 }
 return {svg:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><title>${xml(template.text)}</title>${groups.join('')}</svg>`),mark:{position:'distributed',layers:1,groups:marks.length,angle:template.angle,opacity:template.opacity,positions:marks}};
}
