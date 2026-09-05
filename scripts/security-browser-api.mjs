import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

const host='127.0.0.1',port=55431,upstream='http://127.0.0.1:55430';
const signingKey='showdown-local-test-signing-key-never-use-in-production';
const otpByEmail=new Map();
let edgeHandler;

function jwt(role){
  const encode=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  const body=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',iat:now,exp:now+3600})}`;
  return `${body}.${createHmac('sha256',signingKey).update(body).digest('base64url')}`;
}

const env={
  SUPABASE_URL:upstream,SUPABASE_SERVICE_ROLE_KEY:jwt('service_role'),
  OTP_HASH_SECRET:'showdown-local-browser-otp-hmac',OTP_ALLOWED_ORIGINS:'http://127.0.0.1:5173',
  EMAILJS_SERVICE_ID:'local',EMAILJS_TEMPLATE_ID:'local',EMAILJS_PUBLIC_KEY:'local',
};

globalThis.Deno={env:{get:(name)=>env[name]},serve:(handler)=>{edgeHandler=handler;}};
const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url==='https://api.emailjs.com/api/v1.0/email/send'){
    const payload=JSON.parse(String(init?.body??'{}'));
    const email=payload?.template_params?.to_email;
    const code=payload?.template_params?.code;
    if(typeof email==='string'&&typeof code==='string')otpByEmail.set(email.trim().toLowerCase(),code);
    return new Response(null,{status:200});
  }
  return nativeFetch(input,init);
};

await import('../supabase/functions/login-otp/index.ts');
if(typeof edgeHandler!=='function')throw new Error('Local OTP handler did not start');

function readBody(request){
  return new Promise((resolve,reject)=>{const chunks=[];
    request.on('data',(chunk)=>chunks.push(chunk));request.on('end',()=>resolve(Buffer.concat(chunks)));
    request.on('error',reject);
  });
}
function headersForRequest(request){
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)){
    if(Array.isArray(value))for(const item of value)headers.append(name,item);
    else if(typeof value==='string')headers.set(name,value);
  }
  return headers;
}
function send(response,status,headers,body){
  response.writeHead(status,Object.fromEntries(headers.entries()));response.end(body);
}
function addCors(headers,origin){
  if(origin==='http://127.0.0.1:5173')headers.set('Access-Control-Allow-Origin',origin);
  headers.set('Access-Control-Allow-Headers',
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept-profile, content-profile');
  headers.set('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Cache-Control','no-store');headers.set('Vary','Origin');
}

const server=createServer(async(request,response)=>{
  try{
    const url=new URL(request.url??'/',`http://${host}:${port}`);
    const origin=typeof request.headers.origin==='string'?request.headers.origin:'';
    if(url.pathname==='/__test/otp'){
      const code=otpByEmail.get((url.searchParams.get('email')??'').trim().toLowerCase());
      const headers=new Headers({'Content-Type':'application/json; charset=utf-8'});addCors(headers,origin);
      send(response,code?200:404,headers,JSON.stringify(code?{code}:{error:'not_found'}));return;
    }
    if(request.method==='OPTIONS'&&!url.pathname.startsWith('/functions/v1/login-otp/')){
      const headers=new Headers();addCors(headers,origin);send(response,204,headers,null);return;
    }
    const body=await readBody(request);
    if(url.pathname.startsWith('/functions/v1/login-otp/')){
      const edgeRequest=new Request(`http://${host}:${port}${url.pathname}${url.search}`,{
        method:request.method,headers:headersForRequest(request),
        body:['GET','HEAD'].includes(request.method??'GET')?undefined:body,
      });
      const edgeResponse=await edgeHandler(edgeRequest);
      send(response,edgeResponse.status,new Headers(edgeResponse.headers),Buffer.from(await edgeResponse.arrayBuffer()));return;
    }
    if(!url.pathname.startsWith('/auth/v1/')&&!url.pathname.startsWith('/rest/v1/')){
      send(response,404,new Headers({'Content-Type':'application/json'}),JSON.stringify({error:'not_found'}));return;
    }
    const proxied=await nativeFetch(`${upstream}${url.pathname}${url.search}`,{
      method:request.method,headers:headersForRequest(request),
      body:['GET','HEAD'].includes(request.method??'GET')?undefined:body,signal:AbortSignal.timeout(12_000),
    });
    if(url.pathname.startsWith('/auth/v1/')||!proxied.ok)
      console.error(`Local browser proxy ${request.method} ${url.pathname} returned ${proxied.status}`);
    const headers=new Headers(proxied.headers);addCors(headers,origin);
    send(response,proxied.status,headers,Buffer.from(await proxied.arrayBuffer()));
  }catch{
    const headers=new Headers({'Content-Type':'application/json; charset=utf-8'});
    send(response,503,headers,JSON.stringify({error:'local_browser_api_unavailable'}));
  }
});

server.listen(port,host,()=>console.log(`Local browser API ready at http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
