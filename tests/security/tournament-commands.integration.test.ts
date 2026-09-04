import {createHmac,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {beforeAll,describe,expect,it} from 'vitest';
import {localSql} from '../../scripts/security-local.mjs';
import {verifyOtpAndIssueSession} from '../../supabase/functions/login-otp/session';

const base='http://127.0.0.1:55430',prefix=`tournament-write-${randomUUID()}`;
const id=(name:string)=>`${prefix}-${name}`,email=(name:string)=>`${id(name)}@example.test`;
function token(role:string){const enc=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=`${enc({alg:'HS256',typ:'JWT'})}.${enc({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${body}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production').update(body).digest('base64url')}`;}
const anon=token('anon'),service=token('service_role');
const headers=(access:string)=>({apikey:anon,Authorization:`Bearer ${access}`,'Content-Type':'application/json'});
async function rpc(name:string,access:string,args:object){return fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(access),body:JSON.stringify(args)});}
async function login(name:string){const result=await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  if(!result.verified)throw Error('login failed');await rpc('club_open_session',result.session.access_token,{});return result.session.access_token;}
const values=(title='Protected event')=>({title,image_url:'',address:'Club',start_date:'2026-10-05',start_time:'19:00',
  total_seats:3,guarantee:20000,about:'About',features:['Freezeout'],late_reg_until:'22:45',
  blind_structure:'Smooth',blind_structure_id:null,stack_size:50000,level_duration:'20 мин',is_bounty:false,
  admin_secret_comment:null});

describe('protected tournament creation and editing',()=>{let admin='',user='';const existing=id('existing'),closed=id('closed');
  beforeAll(async()=>{
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin) values
      ('${id('admin')}','${email('admin')}','Admin',true),('${id('user')}','${email('user')}','User',false),
      ('${id('player')}','${email('player')}','Player',false);
      insert into public.tournaments(id,title,start_date,total_seats,guarantee,admin_secret_comment)
        values('${existing}','Existing','2026-10-01',2,1000,'Private note');
      insert into public.tournaments(id,title,start_date,total_seats,guarantee,is_closed,results_entered,rubies_distributed)
        values('${closed}','Closed','2026-09-01',2,1000,true,true,true);
      insert into public.participants(id,tournament_id,user_id,nickname,rating) values
        ('${existing}:${id('player')}','${existing}','${id('player')}','Player',77),
        ('${existing}:guest-two','${existing}',null,'Guest Two',0);
      insert into public.transactions(id,tournament_id,user_id,type,amount,status) values
        ('${id('tx')}','${existing}','${id('player')}','buy-in',1000,'paid');`);
    localSql(readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260904_authenticated_policies.sql','utf8'));
    const migration=readFileSync('supabase/migrations/20260904_tournament_commands.sql','utf8');localSql(migration);localSql(migration);
    for(let attempt=0;attempt<20;attempt++){if((await rpc('club_create_tournament',anon,{p_request_id:randomUUID(),p_values:values()})).status!==404)break;
      await new Promise(resolve=>setTimeout(resolve,100));}
    localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ('${email('admin')}','synthetic-hmac','ip',now()+interval '5 minutes'),
      ('${email('user')}','synthetic-hmac','ip',now()+interval '5 minutes');`);
    [admin,user]=await Promise.all([login('admin'),login('user')]);
  });

  it('denies anonymous and ordinary users',async()=>{for(const access of [anon,user]){
    expect((await rpc('club_create_tournament',access,{p_request_id:randomUUID(),p_values:values()})).status).toBeGreaterThanOrEqual(400);
    expect((await rpc('club_update_tournament',access,{p_request_id:randomUUID(),p_tournament_id:existing,p_changes:{title:'Forged'}})).status).toBeGreaterThanOrEqual(400);}});

  it('returns a role-filtered snapshot without exposing private legacy fields',async()=>{const [userResponse,adminResponse]=await Promise.all([
    rpc('club_tournament_snapshot',user,{}),rpc('club_tournament_snapshot',admin,{})]);
    expect(userResponse.status).toBe(200);expect(adminResponse.status).toBe(200);
    const userRow=(await userResponse.json() as Array<Record<string,unknown>>).find(row=>row.id===existing)!;
    const adminRow=(await adminResponse.json() as Array<Record<string,unknown>>).find(row=>row.id===existing)!;
    expect(userRow.admin_secret_comment).toBeNull();expect(adminRow.admin_secret_comment).toBe('Private note');
    expect(userRow.staff).toEqual([]);expect(userRow.dealers).toEqual([]);
  });

  it('creates exactly once on concurrent retries and derives protected state',async()=>{const requestId=randomUUID(),payload=values('Created once');
    const responses=await Promise.all([rpc('club_create_tournament',admin,{p_request_id:requestId,p_values:payload}),
      rpc('club_create_tournament',admin,{p_request_id:requestId,p_values:payload})]);expect(responses.map(row=>row.status)).toEqual([200,200]);
    const result=await responses[0].json() as {tournament_id:string};
    expect(localSql(`select count(*),bool_and(not is_closed and not results_entered and not rubies_distributed) from public.tournaments where id='${result.tournament_id}';`)).toBe('1|t');
    expect(localSql(`select count(*) from public.logs where target_tournament_id='${result.tournament_id}' and action_type='Создал турнир';`)).toBe('1');
    expect((await rpc('club_create_tournament',admin,{p_request_id:requestId,p_values:values('Changed')})).status).toBe(400);
  });

  it('rejects client-owned state, unknown fields and invalid values',async()=>{for(const payload of [
    {...values(),is_closed:true},{...values(),staff:[]},{...values(),total_seats:0},{...values(),start_time:'99:00'},
  ])expect((await rpc('club_create_tournament',admin,{p_request_id:randomUUID(),p_values:payload})).status).toBe(400);
    expect((await rpc('club_update_tournament',admin,{p_request_id:randomUUID(),p_tournament_id:existing,p_changes:{results_entered:true}})).status).toBe(400);
  });

  it('updates only requested metadata and preserves participants, finance and state',async()=>{const response=await rpc('club_update_tournament',admin,
    {p_request_id:randomUUID(),p_tournament_id:existing,p_changes:{title:'Renamed',about:'Safe edit'}});expect(response.status).toBe(200);
    expect(localSql(`select title,about,is_closed,results_entered,rubies_distributed from public.tournaments where id='${existing}';`)).toBe('Renamed|Safe edit|f|f|f');
    expect(localSql(`select count(*),max(rating) from public.participants where tournament_id='${existing}';`)).toBe('2|77');
    expect(localSql(`select count(*),max(amount) from public.transactions where tournament_id='${existing}';`)).toBe('1|1000');
  });

  it('enforces occupied-seat and closed-scoring invariants',async()=>{
    expect((await rpc('club_update_tournament',admin,{p_request_id:randomUUID(),p_tournament_id:existing,p_changes:{total_seats:1}})).status).toBe(400);
    for(const changes of [{guarantee:9999},{is_bounty:true}])expect((await rpc('club_update_tournament',admin,
      {p_request_id:randomUUID(),p_tournament_id:closed,p_changes:changes})).status).toBe(400);
  });

  it('denies direct reads, writes and cascade delete to every authenticated client',async()=>{
    const get=await fetch(`${base}/rest/v1/tournaments?id=eq.${encodeURIComponent(existing)}`,{headers:headers(admin)});
    const post=await fetch(`${base}/rest/v1/tournaments`,{method:'POST',headers:headers(admin),body:JSON.stringify({id:id('direct'),title:'Direct',start_date:'2026-10-01'})});
    const patch=await fetch(`${base}/rest/v1/tournaments?id=eq.${encodeURIComponent(existing)}`,{method:'PATCH',headers:headers(admin),body:JSON.stringify({title:'Direct'})});
    const remove=await fetch(`${base}/rest/v1/tournaments?id=eq.${encodeURIComponent(existing)}`,{method:'DELETE',headers:headers(admin)});
    expect([get.status,post.status,patch.status,remove.status].every(status=>status>=400)).toBe(true);
    expect(localSql(`select title,(select count(*) from public.participants where tournament_id='${existing}'),
      (select count(*) from public.transactions where tournament_id='${existing}') from public.tournaments where id='${existing}';`)).toBe('Renamed|2|1');
    expect(localSql(`select has_table_privilege('authenticated','public.tournaments','SELECT'),has_table_privilege('authenticated','public.tournaments','INSERT'),has_table_privilege('authenticated','public.tournaments','UPDATE'),has_table_privilege('authenticated','public.tournaments','DELETE');`)).toBe('f|f|f|f');
  });

  it('rolls back the edit and receipt when audit insertion fails',async()=>{const requestId=randomUUID();
    localSql(`create function public.fail_tournament_write_log() returns trigger language plpgsql as $$begin
      if new.target_tournament_id='${existing}' then raise exception 'fail';end if;return new;end$$;
      create trigger fail_tournament_write_log before insert on public.logs for each row execute function public.fail_tournament_write_log();`);
    try{expect((await rpc('club_update_tournament',admin,{p_request_id:requestId,p_tournament_id:existing,p_changes:{about:'Must rollback'}})).status).toBeGreaterThanOrEqual(400);
      expect(localSql(`select about from public.tournaments where id='${existing}';`)).toBe('Safe edit');
      expect(localSql(`select count(*) from club_private.tournament_write_requests where request_id='${requestId}';`)).toBe('0');
    }finally{localSql('drop trigger fail_tournament_write_log on public.logs;drop function public.fail_tournament_write_log();')}
  });
});
