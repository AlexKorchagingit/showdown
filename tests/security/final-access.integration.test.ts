import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {beforeAll,describe,expect,it} from 'vitest';
import {localSql} from '../../scripts/security-local.mjs';
import {verifyOtpAndIssueSession} from '../../supabase/functions/login-otp/session';

const base='http://127.0.0.1:55430',prefix=`final-access-${randomUUID()}`;
const id=(name:string)=>`${prefix}-${name}`,email=(name:string)=>`${id(name)}@example.test`;
function token(role:string){const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${body}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production').update(body).digest('base64url')}`;}
const anon=token('anon'),service=token('service_role');
const headers=(access:string)=>({apikey:anon,Authorization:`Bearer ${access}`,'Content-Type':'application/json'});
async function rpc(name:string,access:string,args:object={}){return fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(access),body:JSON.stringify(args)});}
async function login(name:string){const result=await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  if(!result.verified)throw Error('login failed');await rpc('club_open_session',result.session.access_token);return result.session.access_token;}

const migrations=['20260903_auth_foundation.sql','20260903_finance_commands.sql','20260903_personnel_commands.sql',
  '20260903_registered_dealer_hours.sql','20260903_transaction_voids.sql','20260903_wallet_shop.sql',
  '20260904_anon_access.sql','20260904_authenticated_policies.sql','20260904_ruby_grants.sql',
  '20260904_tournament_closure.sql','20260904_profile_updates.sql','20260904_user_update_acl.sql',
  '20260904_tournament_registration.sql','20260904_participant_commands.sql','20260904_tournament_commands.sql',
  '20260905_audit_timer_commands.sql'];

describe('final client access matrix after the complete local cutover',()=>{let superadmin='',admin='',user='';const event=id('event');
  beforeAll(async()=>{
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin) values
      ('${id('super')}','${email('super')}','Super',true),('${id('admin')}','${email('admin')}','Admin',true),
      ('${id('user')}','${email('user')}','User',false);
      insert into public.tournaments(id,title,start_date,total_seats,admin_secret_comment)
        values('${event}','Final event','2026-10-10',3,'Private note');
      insert into public.participants(id,tournament_id,user_id,nickname) values
        ('${event}:${id('user')}','${event}','${id('user')}','User');
      insert into public.transactions(id,tournament_id,user_id,type,amount,status) values
        ('${id('tx')}','${event}','${id('user')}','buy-in',1000,'unpaid');`);
    localSql(migrations.map(name=>readFileSync(`supabase/migrations/${name}`,'utf8')).join('\n'));
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('super')}';
      insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ('${email('super')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('admin')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('user')}','synthetic-hmac','ip',now()+interval '5 minutes');`);
    for(let attempt=0;attempt<20;attempt++){if((await rpc('club_audit_snapshot',anon)).status!==404)break;
      await new Promise(resolve=>setTimeout(resolve,100));}
    [superadmin,admin,user]=await Promise.all([login('super'),login('admin'),login('user')]);
  },120000);

  it('has no anonymous table or routine access and no unconditional TRUE policy',()=>{
    expect(localSql(`select coalesce(bool_or(has_table_privilege('anon',format('%I.%I',schemaname,tablename),'SELECT,INSERT,UPDATE,DELETE')),'f')
      from pg_tables where schemaname in ('public','club_private');`)).toBe('f');
    expect(localSql(`select coalesce(bool_or(has_function_privilege('anon',p.oid,'EXECUTE')),'f') from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','club_private');`)).toBe('f');
    expect(localSql(`select count(*) from pg_policies where schemaname='public'
      and (coalesce(qual,'')~'^\\s*true\\s*$' or coalesce(with_check,'')~'^\\s*true\\s*$');`)).toBe('0');
  });

  it('leaves only the intended authenticated read grants and no direct protected writes',()=>{
    expect(localSql(`select has_table_privilege('authenticated','public.users','SELECT'),
      has_table_privilege('authenticated','public.tournaments','SELECT'),has_table_privilege('authenticated','public.participants','SELECT'),
      has_table_privilege('authenticated','public.transactions','SELECT'),has_table_privilege('authenticated','public.logs','SELECT'),
      has_table_privilege('authenticated','public.timer_sessions','SELECT');`)).toBe('t|f|t|t|f|t');
    expect(localSql(`select coalesce(bool_or(has_table_privilege('authenticated',format('%I.%I',schemaname,tablename),'INSERT,UPDATE,DELETE')),'f')
      from pg_tables where schemaname in ('public','club_private');`)).toBe('f');
  });

  it('keeps profile and finance row visibility separated by role',async()=>{
    const filter=encodeURIComponent(`(${id('super')},${id('admin')},${id('user')})`);
    const userProfiles=await fetch(`${base}/rest/v1/users?select=id&id=in.${filter}`,{headers:headers(user)});
    const adminProfiles=await fetch(`${base}/rest/v1/users?select=id&id=in.${filter}`,{headers:headers(admin)});
    expect((await userProfiles.json() as unknown[]).length).toBe(1);expect((await adminProfiles.json() as unknown[]).length).toBe(3);
    const userFinance=await fetch(`${base}/rest/v1/transactions?select=id&user_id=eq.${encodeURIComponent(id('user'))}`,{headers:headers(user)});
    expect((await userFinance.json() as unknown[]).length).toBe(1);
  });

  it('serves tournaments only through a role-filtered projection',async()=>{
    expect((await fetch(`${base}/rest/v1/tournaments?select=id`,{headers:headers(admin)})).status).toBeGreaterThanOrEqual(400);
    const [userSnapshot,adminSnapshot]=await Promise.all([rpc('club_tournament_snapshot',user),rpc('club_tournament_snapshot',admin)]);
    const userRow=(await userSnapshot.json() as Array<Record<string,unknown>>).find(row=>row.id===event)!;
    const adminRow=(await adminSnapshot.json() as Array<Record<string,unknown>>).find(row=>row.id===event)!;
    expect(userRow.admin_secret_comment).toBeNull();expect(adminRow.admin_secret_comment).toBe('Private note');
  });

  it('keeps audit SuperAdmin-only and timer Admin/SuperAdmin-only',async()=>{
    expect((await rpc('club_audit_snapshot',user)).status).toBeGreaterThanOrEqual(400);
    expect((await rpc('club_audit_snapshot',admin)).status).toBeGreaterThanOrEqual(400);
    expect((await rpc('club_audit_snapshot',superadmin)).status).toBe(200);
    expect(await (await fetch(`${base}/rest/v1/timer_sessions?id=eq.live`,{headers:headers(user)})).json()).toEqual([]);
    expect((await (await fetch(`${base}/rest/v1/timer_sessions?id=eq.live`,{headers:headers(admin)})).json() as unknown[]).length).toBe(1);
  });

  it('preserves the explicit Admin and SuperAdmin assignments',()=>{
    expect(localSql(`select user_id,role from club_private.profile_roles where user_id in ('${id('admin')}','${id('super')}') order by role;`))
      .toBe(`${id('admin')}|admin\n${id('super')}|superadmin`);
  });
});
