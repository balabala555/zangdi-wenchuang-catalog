import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {brandConfig} from '../src/brand.js';
const originals={
 '15289007429':'d5052393ee57d98c3877ad3b5751968f22203aa453acfc8e25e23a14fbb9feeb',
 '18673575510':'3a013fc9b70024981432d08aa2853b576ce72d7827755afb68cda0c3ba459dc4',
};
test('both customer QR files match uploaded originals byte for byte and map to filename-labelled IDs',async()=>{
 for(const service of brandConfig.customerServices){
  assert.equal(service.qrCodePath,`public/branding/wechat-${service.wechatId}.jpg`);
  const bytes=await readFile(new URL('../'+service.qrCodePath,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),originals[service.wechatId]);
  const info=await sharp(bytes).metadata();assert.equal(info.width,888);assert.equal(info.height,1131);assert.equal(info.format,'jpeg');
 }
 assert.equal(brandConfig.showWebsiteUrl,false);assert.equal(brandConfig.websiteUrl,'');
});
