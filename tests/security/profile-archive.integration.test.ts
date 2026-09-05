import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {beforeAll,describe,expect,it} from 'vitest';
import {localSql} from '../../scripts/security-local.mjs';
import {verifyOtpAndIssueSession} from '../../supabase/functions/login-otp/session';

const base='http://127.0.0.1:55430',prefix=`profile-archive-${randomUUID()}`;
const id=(name:string)=>`${prefix}-${name}`,email=(name:string)=>`${id(name)}@example.test`;
function token(role:string){const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${body}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production').update(body).digest('base64url')}`;}
const anon=token('anon'),service=token('service_role');
const headers=(access:string)=>({apikey:anon,Authorization:`Bearer ${access}`,'Content-Type':'application/json'});
async function rpc(name:string,access:string,args:object={}){return fetch(`${base}/rest/v1/rpc/${name}`,{
  method:'POST',headers:headers(access),body:JSON.stringify(args)});}
async function login(name:string){const result=await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  if(!result.verified)throw Error('login failed');await rpc('club_open_session',result.session.access_token);return result.session.access_token;}

const migrations=['20260903_auth_foundation.sql','20260903_finance_commands.sql','20260903_personnel_commands.sql',
  '20260903_registered_dealer_hours.sql','20260903_transaction_voids.sql','20260903_wallet_shop.sql',
  '20260904_anon_access.sql','20260904_authenticated_policies.sql','20260904_ruby_grants.sql',
  '20260904_tournament_closure.sql','20260904_profile_updates.sql','20260904_user_update_acl.sql',
  '20260904_tournament_registration.sql','20260904_participant_commands.sql','20260904_tournament_commands.sql',
  '20260905_audit_timer_commands.sql','20260905_profile_archive.sql'];

describe('safe profile archival',()=>{let superadmin='',admin='',user='';const event=id('event');
  beforeAll(async()=>{
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin) values
      ('${id('super')}','${email('super')}','Super',true),('${id('admin')}','${email('admin')}','Admin',true),
      ('${id('user')}','${email('user')}','User',false);
      insert into public.tournaments(id,title,start_date,total_seats) values('${event}','Archive event','2026-10-10',3);
      insert into public.participants(id,tournament_id,user_id,nickname) values
        ('${event}:${id('user')}','${event}','${id('user')}','User');
      insert into public.transactions(id,tournament_id,user_id,type,amount,status) values
        ('${id('tx')}','${event}','${id('user')}','buy-in',1000,'paid');`);
    localSql(migrations.map(name=>readFileSync(`supabase/migrations/${name}`,'utf8')).join('\n'));
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('super')}';
      insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ('${email('super')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('admin')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('user')}','synthetic-hmac','ip',now()+interval '5 minutes');`);
    for(let attempt=0;attempt<20;attempt++){if((await rpc('club_archive_profile',anon,{p_request_id:randomUUID(),p_user_id:id('user'),p_reason:'test'})).status!==404)break;
      await new Promise(resolve=>setTimeout(resolve,100));}
    [superadmin,admin,user]=await Promise.all([login('super'),login('admin'),login('user')]);
  },120000);

  it('changes no existing role during migration and exposes no private archive table',async()=>{
    expect(localSql(`select user_id,role from club_private.profile_roles where user_id in ('${id('admin')}','${id('super')}') order by role;`))
      .toBe(`${id('admin')}|admin\n${id('super')}|superadmin`);
    expect((await fetch(`${base}/rest/v1/archived_profiles?select=*`,{headers:headers(superadmin)})).status).toBeGreaterThanOrEqual(400);
  });

  it('denies anonymous, User and Admin callers',async()=>{
    for(const access of [anon,user,admin]){
      const response=await rpc('club_archive_profile',access,{p_request_id:randomUUID(),p_user_id:id('user'),p_reason:'duplicate profile'});
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect(localSql(`select count(*) from club_private.archived_profiles where user_id='${id('user')}';`)).toBe('0');
  });

  it('protects the current and every SuperAdmin account',async()=>{
    for(const target of [id('super')]){
      const response=await rpc('club_archive_profile',superadmin,{p_request_id:randomUUID(),p_user_id:target,p_reason:'must stay active'});
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('blocks the account while preserving profile, role, tournament, finance and history',async()=>{
    const requestId=randomUUID(),args={p_request_id:requestId,p_user_id:id('user'),p_reason:'duplicate profile'};
    const first=await rpc('club_archive_profile',superadmin,args);expect(first.status).toBe(200);
    const firstResult=await first.json() as Record<string,unknown>;
    expect(firstResult).toMatchObject({request_id:requestId,user_id:id('user'),archived:true,already_archived:false});
    const repeated=await rpc('club_archive_profile',superadmin,args);expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual(firstResult);
    expect(localSql(`select
      (select count(*) from public.users where id='${id('user')}'),
      (select role from club_private.profile_roles where user_id='${id('user')}'),
      (select count(*) from public.participants where user_id='${id('user')}'),
      (select count(*) from public.transactions where user_id='${id('user')}'),
      (select count(*) from public.logs where action_type='Архивация профиля' and target_user_id='${id('user')}');`))
      .toBe('1|user|1|1|1');
    expect(await (await rpc('club_current_account',user)).json()).toBeNull();
    const directory=await (await rpc('club_directory',superadmin)).json() as Array<{id:string}>;
    expect(directory.some(row=>row.id===id('user'))).toBe(false);
  });

  it('rejects reuse of a confirmed request identity with changed parameters',async()=>{
    const requestId=randomUUID();
    expect((await rpc('club_archive_profile',superadmin,{p_request_id:requestId,p_user_id:id('user'),p_reason:'duplicate profile'})).status).toBe(200);
    expect((await rpc('club_archive_profile',superadmin,{p_request_id:requestId,p_user_id:id('user'),p_reason:'different reason'})).status)
      .toBeGreaterThanOrEqual(400);
  });
});
