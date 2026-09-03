import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';

const base='http://127.0.0.1:55430';
const prefix=`registration-${randomUUID()}`;
const id=(name:string)=>`${prefix}-${name}`;
const email=(name:string)=>`${id(name)}@example.test`;
function fixtureToken(role:string) {
  const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',
    iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${unsigned}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production')
    .update(unsigned).digest('base64url')}`;
}
const anon=fixtureToken('anon'); const service=fixtureToken('service_role');
const migration=()=>readFileSync('supabase/migrations/20260904_tournament_registration.sql','utf8');
async function rpc(access:string,args:object) {
  return fetch(`${base}/rest/v1/rpc/club_set_registration`,{method:'POST',headers:{apikey:anon,
    Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
}
const request=(tournamentId:string,registered:boolean,extra:object={})=>({p_request_id:randomUUID(),
  p_tournament_id:tournamentId,p_registered:registered,...extra});
async function login(name:string) {
  const result=await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  expect(result.verified).toBe(true);
  if(!result.verified) throw new Error('Synthetic sign-in failed');
  const opened=await fetch(`${base}/rest/v1/rpc/club_open_session`,{method:'POST',headers:{apikey:anon,
    Authorization:`Bearer ${result.session.access_token}`,'Content-Type':'application/json'},body:'{}'});
  expect(opened.status).toBe(200); return result.session.access_token;
}
async function insertDirect(access:string,tournamentId:string,userId:string) {
  return fetch(`${base}/rest/v1/participants`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${access}`,
    'Content-Type':'application/json'},body:JSON.stringify({id:`${tournamentId}:${userId}`,tournament_id:tournamentId,
      user_id:userId,nickname:'Forged',rating:0,knockouts:0})});
}
async function deleteDirect(access:string,tournamentId:string,userId:string) {
  return fetch(`${base}/rest/v1/participants?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {method:'DELETE',headers:{apikey:anon,Authorization:`Bearer ${access}`,Prefer:'return=representation'}});
}

describe('serialized self-registration',()=>{
  let admin=''; let first=''; let second='';
  beforeAll(async()=>{
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin) values
      ('${id('admin')}','${email('admin')}','Registration admin',true),
      ('${id('first')}','${email('first')}','First player',false),
      ('${id('second')}','${email('second')}','Second player',false);
      insert into public.tournaments(id,title,start_date,total_seats,is_closed) values
      ('${id('open')}','Open',current_date,2,false),
      ('${id('capacity')}','Capacity',current_date,1,false),
      ('${id('closed')}','Closed',current_date,2,true),
      ('${id('placed')}','Placed',current_date,2,false);
      insert into public.participants(id,tournament_id,user_id,nickname,rating,place)
      values('${id('placed')}:${id('first')}','${id('placed')}','${id('first')}','First player',0,1);`);
    localSql(readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260904_authenticated_policies.sql','utf8'));
    const before=localSql(`select count(*) from public.participants where tournament_id like '${prefix}%';`);
    localSql(migration()); localSql(migration());
    expect(localSql(`select count(*) from public.participants where tournament_id like '${prefix}%';`)).toBe(before);
    for(let attempt=0;attempt<20;attempt++) {
      if((await rpc(anon,request(id('open'),true))).status!==404) break;
      await new Promise((resolve)=>setTimeout(resolve,100));
    }
    localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ${['admin','first','second'].map((name)=>`('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes')`).join(',')};`);
    [admin,first,second]=await Promise.all([login('admin'),login('first'),login('second')]);
  });

  it('denies anonymous calls, target identities and private receipts',async()=>{
    expect([401,403]).toContain((await rpc(anon,request(id('open'),true))).status);
    expect((await rpc(first,request(id('open'),true,{p_user_id:id('second'),p_nickname:'Forged'}))).status).toBe(404);
    expect(localSql(`select has_table_privilege('authenticated','club_private.registration_requests','SELECT');`)).toBe('f');
  });

  it('registers only the authenticated account using the server nickname',async()=>{
    const response=await rpc(first,request(id('open'),true));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({tournament_id:id('open'),registered:true});
    expect(localSql(`select user_id,nickname,rating,place is null from public.participants where tournament_id='${id('open')}';`))
      .toBe(`${id('first')}|First player|0|t`);
  });

  it('makes same-request retries safe and rejects changed reuse',async()=>{
    const args=request(id('open'),true);
    const responses=await Promise.all([rpc(first,args),rpc(first,args),rpc(first,args)]);
    expect(responses.map((response)=>response.status)).toEqual([200,200,200]);
    expect(localSql(`select count(*) from public.participants where tournament_id='${id('open')}' and user_id='${id('first')}';`)).toBe('1');
    expect(localSql(`select count(*) from club_private.registration_requests where actor_id='${id('first')}' and request_id='${args.p_request_id}';`)).toBe('1');
    expect((await rpc(first,{...args,p_registered:false})).status).toBe(400);
  });

  it('serializes the final seat so only one concurrent registration succeeds',async()=>{
    const responses=await Promise.all([rpc(first,request(id('capacity'),true)),rpc(second,request(id('capacity'),true))]);
    expect(responses.map((response)=>response.status).sort()).toEqual([200,409]);
    expect(localSql(`select count(*),count(distinct user_id) from public.participants where tournament_id='${id('capacity')}';`)).toBe('1|1');
  });

  it('unregisters only itself and rejects closed, unknown, placed and malformed requests',async()=>{
    expect((await rpc(first,request(id('open'),false))).status).toBe(200);
    expect(localSql(`select count(*) from public.participants where tournament_id='${id('open')}';`)).toBe('0');
    for(const args of [request(id('closed'),true),request(id('missing'),true),request(id('placed'),false),
      {...request(id('open'),true),p_request_id:null},{...request(id('open'),true),p_registered:null}]) {
      expect((await rpc(first,args)).status).toBeGreaterThanOrEqual(400);
    }
    expect(localSql(`select count(*) from public.participants where tournament_id='${id('placed')}' and user_id='${id('first')}';`)).toBe('1');
  });

  it('removes ordinary direct insert/delete policies while retaining temporary admin management',async()=>{
    expect([401,403]).toContain((await insertDirect(first,id('open'),id('first'))).status);
    const hiddenDelete=await deleteDirect(first,id('placed'),id('first'));
    expect(hiddenDelete.status).toBe(200);
    expect(await hiddenDelete.json()).toEqual([]);
    expect(localSql(`select count(*) from public.participants where tournament_id='${id('placed')}' and user_id='${id('first')}';`)).toBe('1');
    expect((await insertDirect(admin,id('open'),id('admin'))).status).toBe(201);
    expect((await deleteDirect(admin,id('open'),id('admin'))).status).toBe(200);
    expect(localSql(`select count(*) from pg_policies where schemaname='public' and tablename='participants'
      and policyname in ('participants_insert_authorized','participants_delete_authorized');`)).toBe('0');
  });
});
