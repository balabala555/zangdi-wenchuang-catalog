// Simulate unavailable native binaries without changing any installed package or system setting.
const Module=require('node:module');
const originalLoad=Module._load;
Module._load=function(request,...rest){
 if((/^@img\/sharp-(win32|linux|linuxmusl|darwin|freebsd|webcontainers)/.test(request) && request.endsWith('/sharp.node')) || request.includes('/src/build/Release/'))throw new Error('Test: native module unavailable');
 return originalLoad.call(this,request,...rest);
};
(async()=>{
 const sharp=(await import('sharp')).default;
 if(!sharp.versions.emscripten)throw new Error('Test did not use WebAssembly backend');
 const fs=require('node:fs/promises');
 const layer=await fs.readFile(require('node:path').join(__dirname,'../assets/watermark-text.png'));
 const bytes=await sharp({create:{width:640,height:640,channels:4,background:'#f7f5ef'}}).withIccProfile('srgb').composite([{input:layer,left:10,top:100}]).webp({lossless:true}).toBuffer();
 const info=await sharp(bytes).metadata();if(info.width!==640)throw new Error('Wrong output');
 console.log('PASS official sharp WASM fallback: native modules unavailable; Chinese PNG overlay, ICC, WebP encode/decode work without OS fonts.');
})().catch(error=>{console.error(error);process.exitCode=1;});
