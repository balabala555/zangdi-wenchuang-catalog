import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {homography,project,redactHero,heroCrop} from '../scripts/hero-refinement.mjs';
import {homeSources} from '../src/homepage.js';
import {homepagePhotos} from '../src/generated-homepage-images.js';
test('perspective control lines become level/vertical and degenerate geometry is rejected',()=>{
 const c=homeSources['public/images/homepage/hero.jpg'].refinement,source=c.sourceQuad.map(([x,y])=>[x*1535,y*1151]),dest=[[0,0],[c.width-1,0],[c.width-1,c.height-1],[0,c.height-1]],h=homography(source,dest);
 source.forEach(([x,y],i)=>{const actual=project(h,x,y);for(let k=0;k<2;k++)assert.ok(Math.abs(actual[k]-dest[i][k])<1e-6);});
 for(const [a,b,axis,value]of [[0,1,1,0],[1,2,0,c.width-1],[2,3,1,c.height-1],[3,0,0,0]]){const p=source[a].map((v,k)=>v*.4+source[b][k]*.6);assert.ok(Math.abs(project(h,...p)[axis]-value)<1e-6);}
 assert.throws(()=>homography([[0,0],[0,0],[0,0],[0,0]],dest),/Degenerate/);
});
test('privacy removes QR-like structure throughout core, feather leaves remote product pixels unchanged',async()=>{
 const w=90,h=90,b=Buffer.alloc(w*h*3,160),mask={left:20,top:20,width:50,height:50};
 for(let y=20;y<70;y++)for(let x=20;x<70;x++)for(let k=0;k<3;k++)b[(y*w+x)*3+k]=((x+y)%2)*255;
 const png=await sharp(b,{raw:{width:w,height:h,channels:3}}).png().toBuffer(),out=await redactHero(sharp,png,[mask],10),data=await sharp(out).removeAlpha().raw().toBuffer();
 for(let y=20;y<70;y++)for(let x=20;x<70;x++)for(let k=0;k<3;k++)assert.ok(data[(y*w+x)*3+k]>110 && data[(y*w+x)*3+k]<145,'Sensitive core must contain only low-frequency averages');
 assert.deepEqual(data.subarray(0,3),b.subarray(0,3));assert.ok(data[(45*w+18)*3]!==160,'Edge must blend gradually rather than draw a hard rectangle');
});
test('hero uses separate non-stretched phone/desktop crops and stays within accepted byte budgets',async()=>{
 const p=homepagePhotos['public/images/homepage/hero.jpg'],config=homeSources['public/images/homepage/hero.jpg'].refinement;
 assert.equal(p.privacyMethod,'irreversible-2x2-feathered-v1');
 for(const [size,ratio,budget]of [['card',1.94,85924],['detail',2.15,384170]]){const meta=await sharp(await readFile(p[size].path)).metadata();assert.ok(Math.abs(meta.width/meta.height-ratio)<.015);assert.ok(p[size].bytes<=budget,'Hero download bytes must not exceed v1.2.0');const crop=heroCrop(config.width,config.height,config,size);assert.ok(crop.top>=0 && crop.top+crop.height<=config.height);}
});
