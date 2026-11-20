import test from 'node:test';
import assert from 'node:assert/strict';
import {imageRuntime} from '../scripts/doctor-images.mjs';
import {photoDimensions} from '../src/images.js';
import {homeConfig} from '../src/homepage.js';
test('image runtime diagnoses local backend and verifies an actual WebP round trip',async()=>{const result=await imageRuntime();assert.ok(['native','official-wasm'].includes(result.backend));assert.equal(result.encodeDecode,'PASS');assert.equal(result.platform,process.platform);});
test('homepage image geometry is available before loading and unknown photos stay unknown',()=>{for(const p of homeConfig.categories){const dims=photoDimensions(p.photo);assert.ok(dims.width>0 && dims.height>0);}assert.equal(photoDimensions('public/images/unknown.jpg'),null);});
