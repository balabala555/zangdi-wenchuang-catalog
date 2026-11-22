// Server-side test gate. No plaintext catalogue/assets are deployed, even if Pages fails open.
export default {async fetch(request,env){
 const deny=(status=401)=>new Response(status===401?'仅限授权测试人员':'测试资源暂不可用',{status,headers:{'WWW-Authenticate':'Basic realm="Zangdi private test", charset="UTF-8"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 try{
  const auth=request.headers.get('Authorization')||'';
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const actual=await digest(auth),expected=env.TEST_GATE.verifier;let different=actual.length!==expected.length?1:0;
  for(let i=0;i<actual.length;i++)different|=actual[i]^(expected[i]||0);
  if(different)return deny();
  if(!['GET','HEAD'].includes(request.method))return deny(405);
  const pathname=new URL(request.url).pathname,route=env.TEST_GATE.routes[pathname==='/'?'/index.html':pathname];
  if(!route)return deny(404);
  const key=await crypto.subtle.importKey('raw',await digest('zangdi-test-encryption-v1:'+auth),'AES-GCM',false,['decrypt']);
  const target=new URL('/sealed/'+route.file,request.url),response=await env.ASSETS.fetch(new Request(target,{method:'GET'}));if(!response.ok)return deny(503);
  const bytes=new Uint8Array(await response.arrayBuffer()),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(route.path)},key,bytes.slice(12));
  return new Response(request.method==='HEAD'?null:plain,{headers:{'Content-Type':route.type,'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"}});
 }catch{return deny(503);}
}};
