// Deterministic photo operations only: no inpainting, cloning, generated scene or new objects.
export function homography(from,to){
 const rows=[];for(let i=0;i<4;i++){const [x,y]=from[i],[u,v]=to[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
 for(let c=0;c<8;c++){let pivot=c;for(let r=c+1;r<8;r++)if(Math.abs(rows[r][c])>Math.abs(rows[pivot][c]))pivot=r;[rows[c],rows[pivot]]=[rows[pivot],rows[c]];const d=rows[c][c];if(Math.abs(d)<1e-12)throw Error('Degenerate perspective control points');for(let j=c;j<=8;j++)rows[c][j]/=d;for(let r=0;r<8;r++)if(r!==c){const q=rows[r][c];for(let j=c;j<=8;j++)rows[r][j]-=q*rows[c][j];}}
 return [...rows.map(r=>r[8]),1];
}
export function project(h,x,y){const d=h[6]*x+h[7]*y+h[8];return [(h[0]*x+h[1]*y+h[2])/d,(h[3]*x+h[4]*y+h[5])/d];}
export async function redactHero(sharp,png,masks,feather=22){
 const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});const result=Buffer.from(data),{width:w,height:h,channels:c}=info;
 for(const m of masks){
  // Collapse sensitive core to 2x2 averages (12 color values), discarding all character/QR structure.
  const low=await sharp(png).extract(m).resize(2,2,{fit:'fill',kernel:'linear'}).removeAlpha().raw().toBuffer();
  const left=Math.max(0,m.left-feather),right=Math.min(w,m.left+m.width+feather),top=Math.max(0,m.top-feather),bottom=Math.min(h,m.top+m.height+feather);
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const dx=Math.max(m.left-x,0,x-(m.left+m.width-1)),dy=Math.max(m.top-y,0,y-(m.top+m.height-1));
   const distance=Math.hypot(dx,dy);if(distance>=feather)continue;
   const t=distance/feather,alpha=1-t*t*(3-2*t),u=Math.max(0,Math.min(1,(x-m.left)/Math.max(1,m.width-1))),v=Math.max(0,Math.min(1,(y-m.top)/Math.max(1,m.height-1)));
   for(let k=0;k<3;k++){const value=low[k]*(1-u)*(1-v)+low[3+k]*u*(1-v)+low[6+k]*(1-u)*v+low[9+k]*u*v;const i=(y*w+x)*c+k;result[i]=Math.round(result[i]*(1-alpha)+value*alpha);}
  }
 }
 return sharp(result,{raw:info}).png().toBuffer();
}
export async function rectifyHero(sharp,png,config){
 const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=config;const source=config.sourceQuad.map(([x,y])=>[x*(info.width-1),y*(info.height-1)]),dest=[[0,0],[w-1,0],[w-1,h-1],[0,h-1]],inverse=homography(dest,source),out=Buffer.alloc(w*h*3);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let [sx,sy]=project(inverse,x,y);if(sx< -1e-6||sy< -1e-6||sx>info.width-1+1e-6||sy>info.height-1+1e-6)throw Error('Perspective would require invented edge pixels');sx=Math.max(0,Math.min(info.width-1,sx));sy=Math.max(0,Math.min(info.height-1,sy));
  const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,info.width-1),y1=Math.min(y0+1,info.height-1),fx=sx-x0,fy=sy-y0;
  for(let k=0;k<3;k++)out[(y*w+x)*3+k]=Math.round(data[(y0*info.width+x0)*3+k]*(1-fx)*(1-fy)+data[(y0*info.width+x1)*3+k]*fx*(1-fy)+data[(y1*info.width+x0)*3+k]*(1-fx)*fy+data[(y1*info.width+x1)*3+k]*fx*fy);
 }
 return sharp(out,{raw:{width:w,height:h,channels:3}}).linear(config.whiteBalance,[0,0,0]).modulate({brightness:config.brightness,saturation:1}).sharpen({sigma:config.sharpenSigma}).png().toBuffer();
}
export function heroCrop(width,height,config,size){const ratio=config.ratios[size]||config.ratios.detail,h=Math.min(height,Math.round(width/ratio)),top=Math.max(0,Math.min(height-h,Math.round(height*config.centerY-h/2)));return {left:0,top,width,height:h};}
