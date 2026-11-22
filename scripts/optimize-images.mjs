// Product overlays are disabled by the merchant. Do not rewrite historical public files.
// Current local preview and online packages derive watermark-free files from private originals.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {optimizedPhotos} from '../src/generated-images.js';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));for(const m of Object.values(optimizedPhotos))for(const item of [m.public,m.thumb,m.card,m.detail,...m.legacy]){if(createHash('sha256').update(fs.readFileSync(path.join(root,item.path))).digest('hex')!==item.sha256)throw Error('历史商品素材校验失败，未重写任何照片');}
console.log('商品图片水印已禁用；现行展示从私有原图生成无水印压缩图，历史素材只读保留。');
