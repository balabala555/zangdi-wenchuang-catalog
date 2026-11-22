import {brandConfig} from './brand.js';
import {siteConfig} from './site.js';
// Lists are documents: no diagonal background marks anywhere, including QR quiet zones.
// Product photos retain their own baked-in marks; the original footer provides list branding.
export const exportLayout={width:900,rowHeight:190,photoX:50,photoY:205,photoWidth:145,photoHeight:165,textX:220};
export async function loadExportMark(){return null;} // Backwards-compatible API, no image/network dependency.
export function paintExportBackground(ctx,width,height,mark=null,config=brandConfig,settings=siteConfig.exportWatermark){
 ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,width,height);ctx.restore();
}
// Retain legacy text geometry for the existing export layout. There is no pattern to mask.
export function protectExportText(ctx){
 const original=ctx.fillText.bind(ctx);
 ctx.fillText=(text,x,y,...args)=>{
  const metrics=ctx.measureText(text),size=Number(ctx.font.match(/([\d.]+)px/)?.[1]||20);
  const width=args[0]?Math.min(metrics.width,args[0]):metrics.width;
  const left=ctx.textAlign==='center'?x-width/2:ctx.textAlign==='right'?x-width:x;
  ctx.save();ctx.fillStyle='#f7f5ef';ctx.fillRect(left-4,y-size-3,width+8,size+9);ctx.restore();original(text,x,y,...args);
 };
}
