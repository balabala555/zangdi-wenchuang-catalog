// One merchant configuration shared by image processing, pages, text lists and PNG exports.
export const brandConfig = {
  name: '扎西德勒鸭',
  englishName: 'TIBETAN CRAFTS',
  subtitle: '藏地风物 · 生活美学',
  useRegisteredTrademark: false,
  customerServices: [
    {label: '客服1', wechatId: '15289007429', qrCodePath: 'public/branding/wechat-15289007429.jpg'},
    {label: '客服2', wechatId: '18673575510', qrCodePath: 'public/branding/wechat-18673575510.jpg'},
  ],
  websiteUrl: '',
  showWebsiteUrl: false,
  imageWatermark: {opacity: 0.6, fontScale: 0.3, angle: -25, adaptiveColor: true, adaptiveThreshold: 0.65, lightColor: '#f2e6c5', darkColor: '#656557', fontAssetPath: 'assets/fonts/NotoSansCJKsc-Medium.woff2', outlineRatio: 0.01, minOutlinePx: 0.22, letterSpacing: 0.025, contactSizeRatio: 0.72, maxWidthRatio: 0.22, maxHeightRatio: 0.13, positions: [[0.77,0.18],[0.15,0.29],[0.34,0.43],[0.77,0.48],[0.015,0.56]]},
  brandVisual: {
    fontAssetPath: 'assets/fonts/NotoSerifCJKsc-Regular.woff2',
    lightColor: '#f2e6c5', darkColor: '#42483e', letterSpacing: 0.12,
    mark: {widthRatio: 0.30, leftRatio: 0.035, topRatio: 0.075, maxHeightRatio: 0.18, opacity: 0.95, nameSizeRatio: 0.16, englishSizeRatio: 0.055, subtitleSizeRatio: 0.065},
    footer: {heightRatio: 0.18, minHeightWidthRatio: 0.24, background: '#f7f3e9', color: '#48483e', opacity: 1, fontSizeRatio: 0.022, letterSpacing: 0.035, lineWidthRatio: 0.001, showQrCodes: true, qrWidthRatio: 0.15, nameSizeRatio: 0.04, subtitleSizeRatio: 0.018, englishSizeRatio: 0.012},
    mountain: {width: 214, height: 64, strokeWidth: 1.8, paths: [
      [[0,60],[38,30],[55,39],[96,2],[148,48],[172,30],[214,61]],
      [[38,30],[55,50],[78,32]], [[96,2],[115,33],[98,25],[88,33]], [[172,30],[190,50]],
    ]},
  },
  pageWatermark: {opacity: 0.065, fontSize: 15, angle: -25, color: '#69735c'},
};
export function validateBrand(config=brandConfig){
  if(typeof config.name!=='string' || !config.name.trim() || config.name.length>30 || /[\u0000-\u001f]/.test(config.name))throw new Error('Invalid brand name');
  for(const key of ['englishName','subtitle'])if(typeof config[key]!=='string' || !config[key].trim() || config[key].length>80 || /[\u0000-\u001f]/.test(config[key]))throw new Error('Invalid brand text: '+key);
  if([config.name,config.englishName,config.subtitle].some(text=>text.includes(String.fromCharCode(0x00ae))))throw new Error('Registered trademark symbol is not enabled');
  if(config.useRegisteredTrademark!==false)throw new Error('Registered trademark symbol requires separate confirmation and implementation');
  if(!Array.isArray(config.customerServices) || config.customerServices.length>2)throw new Error('Configure up to two customer services');
  for(const service of config.customerServices){
    if(typeof service.label!=='string' || !service.label.trim() || service.label.length>12 || /[\u0000-\u001f]/.test(service.label))throw new Error('Invalid service label');
    if(service.label.includes(String.fromCharCode(0x00ae)))throw new Error('Registered trademark symbol is not enabled');
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
  const visual=config.brandVisual;
  if(!visual || !/^assets\/fonts\/[a-zA-Z0-9_.-]+\.woff2$/.test(visual.fontAssetPath || ''))throw new Error('Invalid brand serif font');
  for(const color of [visual.lightColor,visual.darkColor,visual.footer.background,visual.footer.color])if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('Invalid brand visual color');
  const range=(value,min,max)=>Number.isFinite(value) && value>=min && value<=max;
  if(!range(visual.letterSpacing,0,0.5) || !range(visual.mark.opacity,0,1) || !range(visual.mark.widthRatio,0.15,0.4) || !range(visual.mark.leftRatio,0,0.2) || !range(visual.mark.topRatio,0,0.1) || !range(visual.mark.maxHeightRatio,0.1,0.25))throw new Error('Invalid brand mark layout');
  for(const key of ['nameSizeRatio','englishSizeRatio','subtitleSizeRatio'])if(!range(visual.mark[key],0.02,0.2))throw new Error('Invalid brand mark font size');
  if(!range(visual.footer.heightRatio,0.06,0.24) || !range(visual.footer.minHeightWidthRatio,0.1,0.32) || !range(visual.footer.opacity,0,1) || !range(visual.footer.fontSizeRatio,0.012,0.035) || !range(visual.footer.letterSpacing,0,0.5) || !range(visual.footer.lineWidthRatio,0.0005,0.004))throw new Error('Invalid brand signature layout');
  if(typeof visual.footer.showQrCodes!=='boolean' || !range(visual.footer.qrWidthRatio,0.12,0.18))throw new Error('Invalid signature QR layout');
  for(const key of ['nameSizeRatio','subtitleSizeRatio','englishSizeRatio'])if(!range(visual.footer[key],0.008,0.06))throw new Error('Invalid signature font size');
  if(!range(config.imageWatermark.adaptiveThreshold,0.2,0.8))throw new Error('Invalid adaptive luminance threshold');
  const protection=config.imageWatermark;
  if(!range(protection.letterSpacing,0,0.3) || !range(protection.contactSizeRatio,0.5,0.9) || !range(protection.maxWidthRatio,0.15,0.4) || !range(protection.maxHeightRatio,0.08,0.2))throw new Error('Invalid protection text layout');
  if(!Array.isArray(protection.positions) || protection.positions.length<2 || protection.positions.length>12 || protection.positions.some(point=>!Array.isArray(point) || point.length!==2 || !range(point[0],0,0.9) || !range(point[1],0.15,0.58)))throw new Error('Invalid distributed positions');
  const mountain=visual.mountain;
  if(!range(mountain.width,50,500) || !range(mountain.height,20,200) || !range(mountain.strokeWidth,0.5,4) || !Array.isArray(mountain.paths) || mountain.paths.length>10 || mountain.paths.some(line=>!Array.isArray(line) || line.length<2 || line.length>20 || line.some(point=>!Array.isArray(point) || point.length!==2 || !range(point[0],0,mountain.width) || !range(point[1],0,mountain.height))))throw new Error('Invalid mountain artwork');
  return config;
}
export function brandMissing(config=brandConfig){return config.customerServices.filter(service=>!service.qrCodePath).map(service=>service.label+'二维码');}
export function contactLines(config=brandConfig){return [config.name,config.englishName,config.subtitle,...config.customerServices.map(service=>service.label+'微信：'+service.wechatId),config.showWebsiteUrl?config.websiteUrl:''].filter(Boolean);}
export function brandFooter(ctx,y,qrImages=[],config=brandConfig){
  if(ctx.beginPath && ctx.moveTo && ctx.lineTo && ctx.stroke){
    const mountain=config.brandVisual.mountain,scale=105/mountain.width;
    ctx.strokeStyle=config.brandVisual.footer.color;ctx.lineWidth=1;
    for(const line of mountain.paths){ctx.beginPath();line.forEach(([x,pY],index)=>{const args=[745+x*scale,y+108+pY*scale];index?ctx.lineTo(...args):ctx.moveTo(...args);});ctx.stroke();}
  }
  ctx.fillStyle='#343b32';ctx.font='26px Georgia,Songti SC,SimSun,serif';ctx.fillText(config.name,50,y+155);
  ctx.fillStyle=config.brandVisual.footer.color;ctx.font='15px Georgia,serif';ctx.fillText(config.englishName,50,y+181);
  ctx.font='17px Songti SC,SimSun,serif';ctx.fillText(config.subtitle,50,y+208);
  ctx.font='19px sans-serif';let cursor=y+243;
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
    return `<g transform="translate(${x},${y}) rotate(${angle})"><g transform="translate(0,-33) scale(0.22)" fill="none" stroke="${escape(color)}" stroke-width="${config.brandVisual.mountain.strokeWidth}">${mountainGeometry(config)}</g><text letter-spacing="0.06em" font-size="${fontSize}" y="0">${escape(config.name)}</text>${service?`<text font-size="${fontSize*0.7}" y="${fontSize*1.3}">微信：${escape(service.wechatId)}</text>`:''}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><g fill="${escape(color)}" font-family="Songti SC,SimSun,serif" font-weight="400">${group(25,75,0)}${group(215,205,1)}</g></svg>`;
}

export function mountainGeometry(config=brandConfig){
  return config.brandVisual.mountain.paths.map(line=>`<polyline points="${line.map(point=>point.join(',')).join(' ')}"/>`).join('');
}
export function mountainSvg(config=brandConfig){
  const shape=config.brandVisual.mountain;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="${shape.strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${mountainGeometry(config)}</g></svg>`;
}
