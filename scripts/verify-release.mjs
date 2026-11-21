// Read-only release gate. Never changes files, Git refs, originals or generated images.
import {readFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {brandConfig,validateBrand} from '../src/brand.js';
import {optimizedPhotos} from '../src/generated-images.js';
import {releaseInfo} from '../src/version.js';
import {homeSources} from '../src/homepage.js';
import {homepagePhotos} from '../src/generated-homepage-images.js';
import {products} from '../src/data.js';
import {siteConfig,validateSite} from '../src/site.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>readFile(path.join(root,file));
export async function verifyRelease({config=brandConfig,manifest=optimizedPhotos,release=releaseInfo}={}){
 validateBrand(config);
 validateSite(siteConfig,config);
 const baseline=JSON.parse(await read('config/accepted-baseline.json'));
 const pkg=JSON.parse(await read('package.json')),lock=JSON.parse(await read('package-lock.json'));
 assert.equal(pkg.version,release.version,'Package/release versions must agree');
 assert.equal(lock.version,release.version);assert.equal(lock.packages[''].version,release.version);
 assert.equal(release.viVersion,baseline.viVersion);assert.equal(release.baselineCommit,baseline.baselineCommit);
 assert.equal(config.assets.enabled,true,'Approved V1.1 assets must stay enabled');
 for(const [file,digest] of Object.entries(baseline.protectedMedia))assert.equal(hash(await read(file)),digest,'Accepted asset changed: '+file);
 for(const file of Object.values(config.assets.files))assert.equal(file.sha256,baseline.protectedMedia[file.path],'Configured asset differs from accepted baseline');
 for(const expected of baseline.products){
  const p=products.find(p=>p.id===expected.id);assert.ok(p,'Accepted product removed: '+expected.id);
  assert.deepEqual({id:p.id,price:p.price,variants:p.variants,variantImages:p.variantImages||null},expected,'Accepted product/variant relationship changed: '+p.id);
 }
 const referenced=[...new Set(products.flatMap(p=>[p.image,p.coverImage,...(p.images||[]),...Object.values(p.variantImages||{}).flat()]).filter(Boolean))];
 const originals=new Set([...baseline.privateOriginalHashes,...Object.values(manifest).map(p=>p.sourceSha256),...Object.values(homepagePhotos).map(p=>p.sourceSha256)]);
 let images=0;
 for(const file of referenced){
  const p=manifest[file];assert.ok(p,'Missing protected image: '+file);assert.equal(p.watermarkVersion,baseline.imageRecipe,'Outdated watermark recipe');
  const recipe=JSON.parse(p.recipe);assert.deepEqual(recipe.brand.assets,config.assets,'Image brand configuration is stale');
  for(const rendition of [p.public,p.thumb,p.card,p.detail,...p.legacy]){const bytes=await read(rendition.path);assert.equal(hash(bytes),rendition.sha256,'Protected image modified: '+rendition.path);assert.ok(!originals.has(hash(bytes)),'Public unwatermarked original: '+rendition.path);images++;}
 }
 for(const source of Object.keys(homeSources)){const p=homepagePhotos[source];assert.ok(p,'Homepage protection missing');assert.equal(p.version,'homepage-vi1.1-private-masks-v1');assert.deepEqual(p.crop,homeSources[source].crop);assert.ok(p.recipe.endsWith(JSON.stringify(homeSources[source])),'Homepage privacy policy is stale');for(const rendition of [p.public,p.thumb,p.card,p.detail]){assert.equal(hash(await read(rendition.path)),rendition.sha256);assert.ok(!originals.has(rendition.sha256));images++;}}
 async function publicFiles(dir){for(const file of await readdir(path.join(root,dir),{withFileTypes:true})){const name=dir+'/'+file.name;if(file.isDirectory())await publicFiles(name);else{
  assert.ok(!/\.(psd|psb|ai|sketch|fig|xd|afdesign|xcf|lnk)$/i.test(name),'Private design/shortcut in public directory: '+name);
  assert.ok(!originals.has(hash(await read(name))),'Unwatermarked photo exposed: '+name);
 }}}
 await publicFiles('public');
 if(existsSync(path.join(root,'.git'))){
  const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  for(const name of candidates){
   assert.ok(!/^(?:\.private-originals|\.private-designs)\//.test(name) && !/\.(psd|psb|ai|sketch|fig|xd|afdesign|xcf|lnk)$/i.test(name),'Private source must not enter Git: '+name);
   if(!existsSync(path.join(root,name)))continue;
   const bytes=await read(name);assert.ok(!originals.has(hash(bytes)),'Unwatermarked original in Git candidates: '+name);
   if(name.endsWith('.html'))for(const match of bytes.toString().matchAll(/data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)/g))assert.ok(!originals.has(hash(Buffer.from(match[1],'base64'))),'Unwatermarked original embedded in HTML: '+name);
  }
 }

 const html=(await read('index.html')).toString();assert.ok(!/山间来信|LETTERS FROM TIBET|山间记忆/.test(html),'Retired brand remains in static HTML');
 assert.ok(html.includes('./public/branding/logo-color.png'),'Static approved logo missing');assert.ok(html.includes('v'+release.version),'Static page release is stale');
 const log=(await read('CHANGELOG.md')).toString();assert.ok(log.includes(release.version),'Release missing from changelog');
 return {version:release.version,viVersion:release.viVersion,protectedAssets:Object.keys(baseline.protectedMedia).length,checkedImageReferences:images};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('PASS release protection',await verifyRelease());
