import {brandConfig,brandAssetUrl} from './brand.js';
import {siteConfig} from './site.js';
// Shared geometry is also used by photo/QR pixel regressions.
export const exportLayout={width:900,rowHeight:190,photoX:50,photoY:205,photoWidth:145,photoHeight:165,textX:220};
export async function loadExportMark(config=brandConfig){
 if(!config.assets?.enabled)return null;
 return new Promise((resolve,reject)=>{
  const image=new Image();let done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve(image);};
  const timer=setTimeout(()=>finish(Error('清单品牌水印加载超时，请重试')),8000);
  image.onload=()=>image.decode().then(()=>finish()).catch(()=>finish(Error('清单品牌水印无法读取，请重试')));
  image.onerror=()=>finish(Error('清单品牌水印加载失败，请重试'));image.src=brandAssetUrl('watermark-dark',config);
 });
}
export function paintExportBackground(ctx,width,height,mark,config=brandConfig,settings=siteConfig.exportWatermark){
 ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,width,height);ctx.save();ctx.globalAlpha=settings.opacity;
 ctx.fillStyle=settings.color;ctx.font='17px sans-serif';ctx.textAlign='center';let index=0;
 for(let y=75,row=0;y<height+150;y+=settings.rowGap,row++)for(let x=row%2?-40:110;x<width+160;x+=settings.columnGap){
  ctx.save();ctx.translate(x,y);ctx.rotate(settings.angle*Math.PI/180);
  if(mark)ctx.drawImage(mark,-80,-38,160,160*mark.naturalHeight/mark.naturalWidth);
  else ctx.fillText(config.name,0,0);
  const service=config.customerServices[index++%config.customerServices.length];
  ctx.fillText('微信：'+service.wechatId,0,58);ctx.restore();
 }
 ctx.restore();
}
// Clear a small paper rectangle behind every label; the pattern never crosses text.
// Photo panels and the original opaque brand/QR artwork cover the pattern separately.
export function protectExportText(ctx){
 const original=ctx.fillText.bind(ctx);
 ctx.fillText=(text,x,y,...args)=>{
  const metrics=ctx.measureText(text),size=Number(ctx.font.match(/([\d.]+)px/)?.[1]||20);
  const width=args[0]?Math.min(metrics.width,args[0]):metrics.width;
  const left=ctx.textAlign==='center'?x-width/2:ctx.textAlign==='right'?x-width:x;
  ctx.save();ctx.fillStyle='#f7f5ef';ctx.fillRect(left-4,y-size-3,width+8,size+9);ctx.restore();original(text,x,y,...args);
 };
}
