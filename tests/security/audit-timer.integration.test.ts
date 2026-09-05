import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {beforeAll,describe,expect,it} from 'vitest';
import {localSql} from '../../scripts/security-local.mjs';
import {verifyOtpAndIssueSession} from '../../supabase/functions/login-otp/session';

const base='http://127.0.0.1:55430',prefix=`audit-timer-${randomUUID()}`;
const id=(name:string)=>`${prefix}-${name}`,email=(name:string)=>`${id(name)}@example.test`;
function token(role:string){const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${body}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production').update(body).digest('base64url')}`;}
const anon=token('anon'),service=token('service_role');
const headers=(access:string)=>({apikey:anon,Authorization:`Bearer ${access}`,'Content-Type':'application/json'});
async function rpc(name:string,access:string,args:object={}){return fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(access),body:JSON.stringify(args)});}
async function login(name:string){const result=await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  if(!result.verified)throw Error('login failed');await rpc('club_open_session',result.session.access_token);return result.session.access_token;}
const snapshot=(writeId:string,revision=1,extra:object={})=>({v:1,writeId,revision,updatedAt:1,structureId:null,
  tournamentId:null,levelIndex:0,secondsLeft:1200,isRunning:false,anchorAt:'2026-09-05T12:00:00.000Z',
  levelDurations:[1200],avgStackOverride:null,chipleaderId:null,totalEntries:null,rebuyCount:null,
  chipleaderStack:null,...extra});
const blindSnapshot=(writeId:string,revision=1,extra:object={})=>({v:1,writeId,revision,updatedAt:1,
  structures:[{id:'bs-test',name:'Test',levelDuration:20,guarantee:1000,
    levels:[{level:1,smallBlind:100,bigBlind:200,ante:200,durationMinutes:20}],
    payouts:[{place:1,share:100}]}],migrations:[],...extra});

describe('protected audit and live timer',()=>{let superadmin='',admin='',user='';
  beforeAll(async()=>{
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    const legacyBlind=JSON.stringify(blindSnapshot('legacy-blinds',3)).replaceAll("'","''");
    localSql(`delete from public.timer_sessions where id='blind-structures';
      delete from public.logs where id in ('blinds-timer-session','blinds-structures','participant-arrivals');
      insert into public.users(id,email,nickname,is_admin) values
      ('${id('super')}','${email('super')}','Super',true),('${id('admin')}','${email('admin')}','Admin',true),
      ('${id('user')}','${email('user')}','User',false),('${id('target')}','${email('target')}','Target',false);
      insert into public.logs(id,admin_email,admin_name,action_type,details) values
      ('blinds-timer-session','timer@showdown.internal','Timer','__timer_session__','{}'),
      ('blinds-structures','blinds@showdown.internal','Blinds','__blind_structures__','${legacyBlind}'),
      ('participant-arrivals','arrivals@showdown.internal','Arrivals','__participant_arrivals__','{}'),
      ('${id('legacy-log')}','legacy@example.test','Legacy','Legacy audit','Preserve me') on conflict(id) do nothing;`);
    localSql(readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8'));
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('super')}';`);
    localSql(readFileSync('supabase/migrations/20260904_authenticated_policies.sql','utf8'));
    const migration=readFileSync('supabase/migrations/20260905_audit_timer_commands.sql','utf8');localSql(migration);localSql(migration);
    for(let attempt=0;attempt<20;attempt++){if((await rpc('club_audit_snapshot',anon)).status!==404)break;
      await new Promise(resolve=>setTimeout(resolve,100));}
    localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ('${email('super')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('admin')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('user')}','synthetic-hmac','ip',now()+interval '5 minutes');`);
    [superadmin,admin,user]=await Promise.all([login('super'),login('admin'),login('user')]);
  });

  it('allows only SuperAdmin to read the protected audit projection',async()=>{
    for(const access of [anon,user,admin])expect((await rpc('club_audit_snapshot',access)).status).toBeGreaterThanOrEqual(400);
    const response=await rpc('club_audit_snapshot',superadmin);expect(response.status).toBe(200);
    const rows=await response.json() as Array<{id:string;action_type:string}>;
    expect(rows.some(row=>row.id===id('legacy-log'))).toBe(true);
    expect(rows.some(row=>row.id==='blinds-timer-session'||row.action_type==='__timer_session__')).toBe(false);
    expect(rows.some(row=>['blinds-structures','participant-arrivals'].includes(row.id))).toBe(false);
    expect(localSql(`select count(*) from public.logs where id='blinds-timer-session';`)).toBe('1');
  });

  it('denies direct audit reads and forged inserts to every client role',async()=>{for(const access of [user,admin,superadmin]){
    const read=await fetch(`${base}/rest/v1/logs?select=id`,{headers:headers(access)});
    const write=await fetch(`${base}/rest/v1/logs`,{method:'POST',headers:headers(access),body:JSON.stringify({
      admin_email:'forged@example.test',admin_name:'Forged',action_type:'Forged audit'})});
    expect(read.status).toBeGreaterThanOrEqual(400);expect(write.status).toBeGreaterThanOrEqual(400);}
    expect(localSql(`select count(*) from public.logs where action_type='Forged audit';`)).toBe('0');
    expect(localSql(`select has_table_privilege('authenticated','public.logs','SELECT'),
      has_table_privilege('authenticated','public.logs','INSERT'),has_table_privilege('authenticated','public.logs','UPDATE'),
      has_table_privilege('authenticated','public.logs','DELETE');`)).toBe('f|f|f|f');
  });

  it('keeps trusted server-side audit working after client ACL revocation',async()=>{
    const response=await rpc('club_set_role',superadmin,{p_user_id:id('target'),p_role:'admin'});expect(response.status).toBe(200);
    expect(localSql(`select count(*) from public.logs where admin_id='${id('super')}' and target_user_id='${id('target')}';`)).toBe('1');
  });

  it('lets only administrators observe the timer and denies every direct write',async()=>{
    const ordinary=await fetch(`${base}/rest/v1/timer_sessions?id=eq.live`,{headers:headers(user)});
    expect(ordinary.status).toBe(200);expect(await ordinary.json()).toEqual([]);
    for(const access of [admin,superadmin]){
      const visible=await fetch(`${base}/rest/v1/timer_sessions?id=eq.live`,{headers:headers(access)});
      expect(visible.status).toBe(200);expect((await visible.json() as unknown[]).length).toBe(1);
    }
    for(const access of [user,admin,superadmin]){
    expect((await fetch(`${base}/rest/v1/timer_sessions?id=eq.live`,{method:'PATCH',headers:headers(access),
      body:JSON.stringify({payload:snapshot('forged')} )})).status).toBeGreaterThanOrEqual(400);}
    expect(localSql(`select has_table_privilege('authenticated','public.timer_sessions','SELECT'),
      has_table_privilege('authenticated','public.timer_sessions','INSERT'),has_table_privilege('authenticated','public.timer_sessions','UPDATE'),
      has_table_privilege('authenticated','public.timer_sessions','DELETE');`)).toBe('t|f|f|f');
  });

  it('allows only current administrators to save a validated timer snapshot',async()=>{
    expect((await rpc('club_save_timer_session',user,{p_snapshot:snapshot('user-write')})).status).toBeGreaterThanOrEqual(400);
    const response=await rpc('club_save_timer_session',admin,{p_snapshot:snapshot('admin-write',5)});expect(response.status).toBe(200);
    const saved=await response.json() as {writeId:string;revision:number;updatedAt:number};
    expect(saved.writeId).toBe('admin-write');expect(saved.revision).toBe(5);expect(saved.updatedAt).toBeGreaterThan(1);
  });

  it('migrates and protects club-wide blind structures behind administrator RPCs',async()=>{
    expect(localSql(`select payload->>'writeId' from public.timer_sessions where id='blind-structures';`)).toBe('legacy-blinds');
    for(const access of [anon,user])expect((await rpc('club_blind_structures_snapshot',access)).status).toBeGreaterThanOrEqual(400);
    for(const access of [admin,superadmin]){
      const response=await rpc('club_blind_structures_snapshot',access);expect(response.status).toBe(200);
      expect((await response.json() as {writeId:string}).writeId).toBe('legacy-blinds');
    }
    expect((await rpc('club_save_blind_structures',user,{p_snapshot:blindSnapshot('user-blinds',4)})).status).toBeGreaterThanOrEqual(400);
    const response=await rpc('club_save_blind_structures',admin,{p_snapshot:blindSnapshot('admin-blinds',4)});
    expect(response.status).toBe(200);expect((await response.json() as {writeId:string}).writeId).toBe('admin-blinds');
    expect((await rpc('club_save_blind_structures',admin,{p_snapshot:blindSnapshot('invalid-blinds',5,{forged:true})})).status).toBe(400);
  });

  it('rejects unknown fields, invalid bounds and nonexistent tournament links',async()=>{for(const invalid of [
    snapshot('extra',6,{forged:true}),snapshot('duration',6,{levelDurations:[0]}),
    snapshot('level',6,{levelIndex:2}),snapshot('unknown',6,{tournamentId:id('missing')}),
  ])expect((await rpc('club_save_timer_session',admin,{p_snapshot:invalid})).status).toBe(400);});

  it('is idempotent by write id and refuses a delayed older revision',async()=>{
    const same=await rpc('club_save_timer_session',admin,{p_snapshot:snapshot('admin-write',5)});
    expect(same.status).toBe(200);expect((await same.json() as {revision:number;secondsLeft:number})).toMatchObject({revision:5,secondsLeft:1200});
    expect((await rpc('club_save_timer_session',admin,{p_snapshot:snapshot('admin-write',99,{secondsLeft:1})})).status).toBe(400);
    const stale=await rpc('club_save_timer_session',admin,{p_snapshot:snapshot('stale-write',4,{secondsLeft:1})});
    expect(stale.status).toBe(200);expect((await stale.json() as {writeId:string}).writeId).toBe('admin-write');
    expect(localSql(`select payload->>'writeId',payload->>'secondsLeft' from public.timer_sessions where id='live';`)).toBe('admin-write|1200');
  });

  it('does not alter the existing Admin or SuperAdmin assignments',()=>{
    expect(localSql(`select user_id,role from club_private.profile_roles where user_id in ('${id('admin')}','${id('super')}') order by role;`))
      .toBe(`${id('admin')}|admin\n${id('super')}|superadmin`);
  });
});
