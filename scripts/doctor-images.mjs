// Read-only, cross-platform diagnostics. Never reinstalls/deletes dependencies or processes originals.
export async function imageRuntime(){
 const [major,minor]=process.versions.node.split('.').map(Number);
 if(major<20 || major===20 && minor<9)throw Error('Node.js需要>=20.9；Windows建议使用当前LTS的正确架构安装包。');
 let sharp;try{sharp=(await import('sharp')).default;}catch{throw Error('图片模块加载失败。请在项目目录运行 npm ci --include=optional；保留锁文件，不复制其他电脑的 node_modules。Windows优先使用64位Node LTS，原生DLL不可用时需要已声明的官方 @img/sharp-wasm32。');}
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#f8f5ec'}}).webp({quality:86}).toBuffer();
 if((await sharp(png).metadata()).width!==8)throw Error('图片模块编码/解码自检未通过');
 return {node:process.versions.node,platform:process.platform,arch:process.arch,backend:sharp.versions.emscripten?'official-wasm':'native',sharp:sharp.versions.sharp,encodeDecode:'PASS'};
}
if(process.argv[1] && new URL(import.meta.url).pathname.endsWith('/'+process.argv[1].split(/[\\/]/).pop())){
 console.log('Image environment',{node:process.versions.node,platform:process.platform,arch:process.arch});
 try{console.log('PASS image runtime',await imageRuntime());}catch(error){console.error(error.message);process.exitCode=1;}
}
