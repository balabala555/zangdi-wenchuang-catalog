// One merchant configuration shared by image processing, pages, text lists and PNG exports.
export const brandConfig = {
  name: '扎西德勒鸭',
  customerServices: [
    {label: '客服1', wechatId: '15289007429', qrCodePath: 'public/branding/wechat-15289007429.jpg'},
    {label: '客服2', wechatId: '18673575510', qrCodePath: 'public/branding/wechat-18673575510.jpg'},
  ],
  websiteUrl: '',
  showWebsiteUrl: false,
  imageWatermark: {opacity: 0.6, fontScale: 0.7, angle: -25, adaptiveColor: true, lightColor: '#ffffff', darkColor: '#000000', fontAssetPath: 'assets/fonts/NotoSansCJKsc-Medium.woff2', outlineRatio: 0.018, minOutlinePx: 0.35},
  pageWatermark: {opacity: 0.065, fontSize: 15, angle: -25, color: '#69735c'},
};
export function validateBrand(config=brandConfig){
  if(typeof config.name!=='string' || !config.name.trim() || config.name.length>30 || /[\u0000-\u001f]/.test(config.name))throw new Error('Invalid brand name');
  if(!Array.isArray(config.customerServices) || config.customerServices.length>2)throw new Error('Configure up to two customer services');
  for(const service of config.customerServices){
    if(typeof service.label!=='string' || !service.label.trim() || service.label.length>12 || /[\u0000-\u001f]/.test(service.label))throw new Error('Invalid service label');
    if(typeof service.wechatId!=='string' || !/^[A-Za-z0-9_-]{1,40}$/.test(service.wechatId))throw new Error('Invalid customer WeChat ID');
    if(service.qrCodePath && (!/^public\/branding\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(service.qrCodePath) || service.qrCodePath.includes('..')))throw new Error('Invalid customer QR path');
  }
  if(typeof config.websiteUrl!=='string' || config.websiteUrl.length>256 || /[\u0000-\u001f]/.test(config.websiteUrl) || typeof config.showWebsiteUrl!=='boolean')throw new Error('Invalid website configuration');
  if(config.websiteUrl){const url=new URL(config.websiteUrl);if(!['http:','https:'].includes(url.protocol) || url.username || url.password)throw new Error('Invalid website URL');}
  if(config.showWebsiteUrl && !config.websiteUrl)throw new Error('A visible website needs a configured URL');
  for(const params of [config.imageWatermark,config.pageWatermark])if(!Number.isFinite(params.opacity) || params.opacity<0 || params.opacity>1 || !Number.isFinite(params.angle) || Math.abs(params.angle)>60)throw new Error('Invalid watermark parameters');
  if(!(config.imageWatermark.fontScale>=0.2 && config.imageWatermark.fontScale<=2) || !(config.pageWatermark.fontSize>=8 && config.pageWatermark.fontSize<=30))throw new Error('Invalid watermark font size');
  if(!/^assets\/fonts\/[a-zA-Z0-9_.-]+\.woff2$/.test(config.imageWatermark.fontAssetPath || ''))throw new Error('Invalid local watermark font');
  if(!(config.imageWatermark.outlineRatio>=0 && config.imageWatermark.outlineRatio<=0.05) || !(config.imageWatermark.minOutlinePx>=0 && config.imageWatermark.minOutlinePx<=1))throw new Error('Invalid watermark outline');
  for(const color of [config.imageWatermark.lightColor,config.imageWatermark.darkColor,config.pageWatermark.color])if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('Invalid watermark color');
  return config;
}
export function brandMissing(config=brandConfig){return config.customerServices.filter(service=>!service.qrCodePath).map(service=>service.label+'二维码');}
export function contactLines(config=brandConfig){return [config.name,...config.customerServices.map(service=>service.label+'微信：'+service.wechatId),config.showWebsiteUrl?config.websiteUrl:''].filter(Boolean);}
export function brandFooter(ctx,y,qrImages=[],config=brandConfig){
  ctx.fillStyle='#343b32';ctx.font='26px sans-serif';ctx.fillText(config.name,50,y+155);
  ctx.font='19px sans-serif';let cursor=y+195;
  for(const service of config.customerServices){ctx.fillText(service.label+'微信：'+service.wechatId,50,cursor);cursor+=30;}
  if(config.showWebsiteUrl && config.websiteUrl){
    let line='',row=0;
    for(const char of config.websiteUrl){
      if(ctx.measureText(line+char).width>750){ctx.fillText(line,50,cursor);line='';cursor+=26;row++;if(row===3)throw new Error('网站地址过长，请使用简短的正式地址');}
      line+=char;
    }
    if(line){ctx.fillText(line,50,cursor);cursor+=26;}
  }
  const top=cursor+15;
  qrImages.forEach(({service,image},index)=>{
    const left=50+index*400;
    // Embed the entire uploaded image, including its original quiet zone/header.
    // Preserve aspect ratio; never crop, recolor, watermark or recreate the QR matrix.
    const scale=Math.min(318/image.naturalWidth,460/image.naturalHeight,1),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.fillStyle='#ffffff';ctx.fillRect(left,top,350,h+32);
    const smoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,left+16+(318-w)/2,top+16,w,h);ctx.imageSmoothingEnabled=smoothing;
    ctx.fillStyle='#7e836f';ctx.font='16px sans-serif';ctx.fillText(service.label+' · 微信 '+service.wechatId,left,top+h+60);
  });
}
export function loadBrandQrs(config=brandConfig){
  return Promise.all(config.customerServices.map(service=>{
    if(!service.qrCodePath)return null;
    return new Promise((resolve,reject)=>{
      const image=new Image();let done=false;
      const finish=error=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve({service,image});};
      const timer=setTimeout(()=>finish(Error(service.label+'二维码加载超时，请重试')),8000);
      image.onload=async()=>{try{await image.decode();finish();}catch{finish(Error(service.label+'二维码无法读取'));}};
      image.onerror=()=>finish(Error(service.label+'二维码加载失败，请重试'));
      image.src=typeof embeddedBrandQrs!=='undefined' && embeddedBrandQrs[service.qrCodePath] || './'+service.qrCodePath;
    });
  })).then(images=>images.filter(Boolean));
}
export function pageWatermarkSvg(config=brandConfig){
  validateBrand(config);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const {fontSize,angle,color}=config.pageWatermark;
  const group=(x,y,index)=>{
    const service=config.customerServices[index%config.customerServices.length];
    return `<g transform="translate(${x},${y}) rotate(${angle})"><text font-size="${fontSize}" y="0">${escape(config.name)}</text>${service?`<text font-size="${fontSize*0.7}" y="${fontSize*1.3}">微信：${escape(service.wechatId)}</text>`:''}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><g fill="${escape(color)}" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-weight="300">${group(25,75,0)}${group(215,205,1)}</g></svg>`;
}
