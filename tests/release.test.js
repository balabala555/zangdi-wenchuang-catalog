import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRelease} from '../scripts/verify-release.mjs';
import {brandConfig,pageWatermarkSvg} from '../src/brand.js';
import {releaseInfo} from '../src/version.js';
import {optimizedPhotos} from '../src/generated-images.js';
test('release gate preserves accepted VI, original QR files, products and all public renditions',async()=>{const result=await verifyRelease();assert.equal(result.version,'1.1.1');assert.equal(result.protectedAssets,7);});
test('release gate rejects mismatched version, stale assets and old image recipes',async()=>{
 await assert.rejects(verifyRelease({release:{...releaseInfo,version:'0.1.0'}}));
 const config=structuredClone(brandConfig);config.assets.files.footer.sha256='0'.repeat(64);await assert.rejects(verifyRelease({config}));
 const manifest=structuredClone(optimizedPhotos);Object.values(manifest)[0].watermarkVersion='old';await assert.rejects(verifyRelease({manifest}));
});
test('page watermark reuses approved artwork while alternating the two actual service IDs',()=>{
 const data='data:image/png;base64,dGVzdA==';const svg=pageWatermarkSvg(brandConfig,data);
 assert.equal((svg.match(/<image /g)||[]).length,2);assert.ok(svg.includes(data));
 for(const service of brandConfig.customerServices)assert.ok(svg.includes(service.wechatId));
 assert.ok(!svg.includes('<polyline'),'Old reconstructed mountain must not be used with approved VI artwork');
});
