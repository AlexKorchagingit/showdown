import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';

const base = 'http://127.0.0.1:55430';
const prefix = `profile-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;

function fixtureToken(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',
    iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${unsigned}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production')
    .update(unsigned).digest('base64url')}`;
}

const anon = fixtureToken('anon');
const service = fixtureToken('service_role');
const migration = () => readFileSync('supabase/migrations/20260904_profile_updates.sql','utf8');

async function rpc(access: string, changes: unknown, extra: object = {}) {
  return fetch(`${base}/rest/v1/rpc/club_update_profile`, { method:'POST', headers:{ apikey:anon,
    Authorization:`Bearer ${access}`,'Content-Type':'application/json' },
    body:JSON.stringify({p_changes:changes,...extra}) });
}

async function call(name: string, access: string, args: object = {}) {
  return fetch(`${base}/rest/v1/rpc/${name}`, { method:'POST', headers:{apikey:anon,
    Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify(args) });
}

async function directUpdate(access: string, userId: string, patch: object) {
  return fetch(`${base}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, { method:'PATCH',headers:{apikey:anon,
    Authorization:`Bearer ${access}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch) });
}

async function login(name: string) {
  const result=await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  expect(result.verified).toBe(true);
  if(!result.verified) throw new Error('Synthetic sign-in failed');
  const opened=await fetch(`${base}/rest/v1/rpc/club_open_session`,{method:'POST',headers:{apikey:anon,
    Authorization:`Bearer ${result.session.access_token}`,'Content-Type':'application/json'},body:'{}'});
  expect(opened.status).toBe(200);
  return result.session.access_token;
}

describe('safe self-service profile updates',() => {
  let admin=''; let owner=''; let user='';
  beforeAll(async()=>{
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin,ruby_balance,birth_date,slogan,
      owned_items,pending_notifications) values
      ('${id('admin')}','${email('admin')}','Admin before',true,111,'1990-01-01','A',array['char_base','legacy'],'[{"id":"a","amount":2,"message":"keep"}]'),
      ('${id('owner')}','${email('owner')}','Owner before',true,222,'1991-02-02','B',array['char_base'],'[]'),
      ('${id('user')}','${email('user')}','User before',false,333,'1992-03-03','C',array['char_base'],'[]'),
      ('${id('target')}','${email('target')}','Target before',false,444,'1993-04-04','D',array['char_base'],'[]');`);
    localSql(readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8'));
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('owner')}';`);
    const before=localSql(`select md5(jsonb_agg(to_jsonb(u) order by u.id)::text) from public.users u where id like '${prefix}%';`);
    localSql(migration()); localSql(migration());
    localSql(readFileSync('supabase/migrations/20260903_wallet_shop.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260904_ruby_grants.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260904_authenticated_policies.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260904_user_update_acl.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260904_user_update_acl.sql','utf8'));
    expect(localSql(`select md5(jsonb_agg(to_jsonb(u) order by u.id)::text) from public.users u where id like '${prefix}%';`)).toBe(before);
    for(let attempt=0;attempt<20;attempt++) {
      if((await rpc(anon,{nickname:'x'})).status!==404) break;
      await new Promise((resolve)=>setTimeout(resolve,100));
    }
    localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ${['admin','owner','user'].map((name)=>`('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes')`).join(',')};`);
    [admin,owner,user]=await Promise.all([login('admin'),login('owner'),login('user')]);
  });

  it('denies anonymous access and never accepts a target account argument',async()=>{
    expect([401,403]).toContain((await rpc(anon,{nickname:'No'})).status);
    expect((await rpc(user,{nickname:'No'},{p_user_id:id('admin')})).status).toBe(404);
  });

  it('lets every verified role update only its own safe fields',async()=>{
    const cases=[[user,'user','User next'],[admin,'admin','Admin next'],[owner,'superadmin','Owner next']] as const;
    for(const [access,role,nickname] of cases) {
      const response=await rpc(access,{nickname,birth_date:'2000-12-31',slogan:'  New slogan  '});
      expect(response.status).toBe(200);
      const saved=await response.json();
      expect(saved).toMatchObject({nickname,birth_date:'2000-12-31',slogan:'New slogan',role});
      expect(saved.is_admin).toBe(role!=='user');
    }
    expect(localSql(`select nickname,ruby_balance,is_admin,array_to_string(owned_items,','),pending_notifications::text
      from public.users where id='${id('user')}';`)).toBe('User next|333|f|char_base|[]');
  });

  it('serializes disjoint profile edits without losing either field',async()=>{
    const responses=await Promise.all([rpc(user,{nickname:'Concurrent'}),rpc(user,{slogan:'Both survive'})]);
    expect(responses.map((response)=>response.status)).toEqual([200,200]);
    expect(localSql(`select nickname,slogan,birth_date from public.users where id='${id('user')}';`))
      .toBe('Concurrent|Both survive|2000-12-31');
  });

  it('rejects protected, unknown, malformed and out-of-range changes without side effects',async()=>{
    const before=localSql(`select md5(to_jsonb(u)::text) from public.users u where id='${id('user')}';`);
    for(const changes of [
      {ruby_balance:999999},{pending_notifications:[]},{is_admin:true},{role:'superadmin'},
      {email:'attacker@example.test'},{owned_items:[]},{agreements_accepted_at:'2000-01-01'},
      {},null,[],{nickname:''},{nickname:'x'.repeat(18)},{nickname:123},
      {slogan:'x'.repeat(61)},{birth_date:'2026-02-31'},{birth_date:'31.12.2000'},
    ]) expect((await rpc(user,changes)).status).toBeGreaterThanOrEqual(400);
    expect(localSql(`select md5(to_jsonb(u)::text) from public.users u where id='${id('user')}';`)).toBe(before);
  });

  it('rejects a banned account even with an already issued token',async()=>{
    localSql(`update auth.users set banned_until=now()+interval '1 hour' where email='${email('user')}';`);
    try {
      expect((await rpc(user,{slogan:'Blocked'})).status).toBe(403);
      expect(localSql(`select slogan from public.users where id='${id('user')}';`)).toBe('Both survive');
    } finally {
      localSql(`update auth.users set banned_until=null where email='${email('user')}';`);
    }
  });

  it('revokes direct users UPDATE from User, Admin and SuperAdmin while protected commands still work',async()=>{
    for(const [access,target] of [[user,id('user')],[admin,id('target')],[owner,id('target')]] as const) {
      for(const patch of [{nickname:'Forged'},{ruby_balance:999999},{is_admin:true},{email:'forged@example.test'},
        {pending_notifications:[]},{owned_items:['forged']}]) {
        expect([401,403]).toContain((await directUpdate(access,target,patch)).status);
      }
    }
    expect(localSql(`select has_table_privilege('anon','public.users','UPDATE'),
      has_table_privilege('authenticated','public.users','UPDATE'),
      count(*) from pg_policies where schemaname='public' and tablename='users' and cmd in ('ALL','UPDATE');`)).toBe('f|f|0');
    expect((await rpc(admin,{slogan:'Admin protected'})).status).toBe(200);
    const grant=await call('club_grant_rubies',admin,{p_request_id:randomUUID(),p_user_id:id('target'),
      p_amount:10,p_message:'Protected grant',p_delivery:'immediate'});
    expect(grant.status).toBe(200);
    expect(localSql(`select ruby_balance,is_admin from public.users where id='${id('target')}';`)).toBe('454|f');
    expect((await call('club_set_role',owner,{p_user_id:id('target'),p_role:'admin'})).status).toBe(200);
    expect(localSql(`select ruby_balance,is_admin from public.users where id='${id('target')}';`)).toBe('454|t');
  });
});
