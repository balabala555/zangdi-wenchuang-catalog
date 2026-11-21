import test from 'node:test';
import assert from 'node:assert/strict';
import {siteConfig,storeLines,onlineServices,validateSite} from '../src/site.js';
import {brandConfig} from '../src/brand.js';
import {products} from '../src/data.js';
import {sanitizeCart,total,listText} from '../src/cart.js';
test('confirmed site/store identity is exact; missing mall photo is never substituted',()=>{
 validateSite(siteConfig,brandConfig);assert.equal(siteConfig.name,'扎西德勒鸭·藏地选物');assert.equal(siteConfig.stores[0].photo,null);
 assert.deepEqual(storeLines(),['八廓商场店｜扎西德勒鸭','八廓街店｜加西得了个鸭']);assert.equal(siteConfig.stores[1].photo,'public/images/homepage/storefront.jpg');
 assert.equal(siteConfig.customerMode,'equal');assert.deepEqual(onlineServices(brandConfig).map(s=>s.wechatId),['15289007429','18673575510']);assert.equal(brandConfig.showWebsiteUrl,false);
});
test('existing cart schema supports separate style quantities and branded dual-store copy without price changes',()=>{
 const p=products.find(p=>p.id==='felt-mushroom-bag'),cart=sanitizeCart([{id:p.id,variant:p.variants[0],quantity:2},{id:p.id,variant:p.variants[2],quantity:3}]);
 assert.equal(cart.length,2);assert.equal(total(cart),450);const text=listText(cart);for(const value of [siteConfig.name,...storeLines(),'15289007429','18673575510',p.variants[0],p.variants[2]])assert.ok(text.includes(value));
 assert.ok(!text.includes('localhost'));assert.equal(p.price,90);
});
