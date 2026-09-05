import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';

const base = 'http://127.0.0.1:55430';
const prefix = `closure-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;

function fixtureToken(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, aud: 'authenticated',
    iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })}`;
  return `${unsigned}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production')
    .update(unsigned).digest('base64url')}`;
}

const anon = fixtureToken('anon');
const service = fixtureToken('service_role');
const migration = () => readFileSync('supabase/migrations/20260904_tournament_closure.sql','utf8');

async function rpc(name: string, access: string, args: object = {}) {
  return fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: anon,
    Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
}

async function login(name: string) {
  const result = await verifyOtpAndIssueSession({ supabaseUrl: base, serviceRoleKey: service }, email(name), 'synthetic-hmac');
  expect(result.verified).toBe(true);
  if (!result.verified) throw new Error('Synthetic sign-in failed');
  expect((await rpc('club_open_session', result.session.access_token)).status).toBe(200);
  return result.session.access_token;
}

function seedTournament(name: string, players = 2, bounty = false, guarantee = 1000) {
  const tournament = id(name);
  localSql(`insert into public.tournaments(id,title,start_date,guarantee,is_bounty) values
    ('${tournament}','Synthetic ${name}',current_date,${guarantee},${bounty});
    ${Array.from({ length: players }, (_, index) => `insert into public.participants
      (id,tournament_id,user_id,nickname,rating,knockouts,arrived) values
      ('${tournament}:p${index+1}','${tournament}',${index < 3 ? `'${id(`p${index+1}`)}'` : 'null'},
       'Player ${index+1}',${(index+1)*10},0,true);`).join('\n')}`);
  return tournament;
}

function results(tournament: string, players = 2) {
  return Array.from({ length: players }, (_, index) => ({
    id: `${tournament}:p${index+1}`,
    place: index+1,
    knockouts: 0,
  }));
}

describe('atomic tournament closure', () => {
  let admin = '';
  let owner = '';
  let user = '';

  beforeAll(async () => {
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8'));
    localSql(readFileSync('supabase/schema.sql','utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql','utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin,ruby_balance) values
      ('${id('admin')}','${email('admin')}','Synthetic admin',true,100),
      ('${id('owner')}','${email('owner')}','Synthetic owner',true,200),
      ('${id('user')}','${email('user')}','Synthetic user',false,300),
      ('${id('p1')}','${email('p1')}','Player one',false,1000),
      ('${id('p2')}','${email('p2')}','Player two',false,2000),
      ('${id('p3')}','${email('p3')}','Player three',false,3000);`);
    localSql(readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8'));
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('owner')}';`);
    const before = localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance)
      from public.users where id like '${prefix}%';`);
    localSql(migration());
    localSql(migration());
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance)
      from public.users where id like '${prefix}%';`)).toBe(before);
    for (let attempt=0; attempt<20; attempt++) {
      if ((await rpc('club_close_tournament',anon,{})).status!==404) break;
      await new Promise((resolve) => setTimeout(resolve,100));
    }
    localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ${['admin','owner','user'].map((name) => `('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes')`).join(',')};`);
    [admin,owner,user] = await Promise.all([login('admin'),login('owner'),login('user')]);
  });

  it('allows only verified administrators and keeps private helpers inaccessible', async () => {
    const tournament = seedTournament('denied');
    const args = { p_request_id: randomUUID(), p_tournament_id: tournament, p_results: results(tournament) };
    for (const access of [anon,user]) expect([401,403]).toContain((await rpc('club_close_tournament',access,args)).status);
    expect(localSql(`select has_table_privilege('authenticated','club_private.tournament_close_requests','SELECT'),
      has_function_privilege('authenticated','club_private.tournament_place_points(integer,integer,integer)','EXECUTE'),
      has_function_privilege('authenticated','club_private.tournament_rubies(integer,integer,integer,boolean)','EXECUTE');`)).toBe('f|f|f');
  });

  it('derives points and rubies on the server and commits flags, wallets and one audit together', async () => {
    const tournament = seedTournament('bounty',4,true,10000);
    const settled = results(tournament,4).map((row,index) => ({ ...row, knockouts: [2,1,0,0][index] }));
    const response = await rpc('club_close_tournament',admin,{ p_request_id:randomUUID(),p_tournament_id:tournament,p_results:settled });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tournament_id:tournament,players:4,credited_rubies:2085 });
    expect(localSql(`select is_closed,results_entered,rubies_distributed from public.tournaments where id='${tournament}';`)).toBe('t|t|t');
    expect(localSql(`select place,knockouts,rating,rubies_awarded from public.participants where tournament_id='${tournament}' order by place;`))
      .toBe('1|2|6710|1010\n2|1|3620|670\n3|0|30|405\n4|0|40|240');
    expect(localSql(`select ruby_balance from public.users where id in ('${id('p1')}','${id('p2')}','${id('p3')}') order by id;`))
      .toBe('2010\n2670\n3405');
    expect(localSql(`select count(*) from public.logs where target_tournament_id='${tournament}' and action_type='Закрыл турнир';`)).toBe('1');
  });

  it('settles only players checked in at the lobby and leaves no-shows untouched', async () => {
    const tournament = seedTournament('no-show',3,false,1000);
    localSql(`update public.participants set arrived=false where id='${tournament}:p3';`);
    const response = await rpc('club_close_tournament',admin,{
      p_request_id:randomUUID(),p_tournament_id:tournament,p_results:results(tournament,2),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({tournament_id:tournament,players:2});
    expect(localSql(`select place is null,rating,rubies_awarded is null from public.participants where id='${tournament}:p3';`))
      .toBe('t|30|t');
  });

  it('serializes retries, credits once and rejects reuse with another payload', async () => {
    const tournament = seedTournament('retry');
    const requestId = randomUUID();
    const args = { p_request_id:requestId,p_tournament_id:tournament,p_results:results(tournament) };
    const responses = await Promise.all([rpc('club_close_tournament',owner,args),rpc('club_close_tournament',owner,args),rpc('club_close_tournament',owner,args)]);
    expect(responses.map((response) => response.status)).toEqual([200,200,200]);
    expect(new Set((await Promise.all(responses.map((response) => response.json()))).map((row) => row.request_id)).size).toBe(1);
    expect(localSql(`select count(*) from club_private.tournament_close_requests where actor_id='${id('owner')}' and request_id='${requestId}';`)).toBe('1');
    expect(localSql(`select count(*) from public.logs where target_tournament_id='${tournament}';`)).toBe('1');
    expect((await rpc('club_close_tournament',owner,{...args,p_results:[...results(tournament)].reverse()})).status).toBe(200);
    const changed = results(tournament); changed[0].knockouts=1;
    expect((await rpc('club_close_tournament',owner,{...args,p_results:changed})).status).toBe(400);
    expect((await rpc('club_close_tournament',owner,{...args,p_request_id:randomUUID()})).status).toBeGreaterThanOrEqual(400);
  });

  it('rejects missing, duplicate, unknown, non-integral and client-award results', async () => {
    const variants: unknown[] = [
      [{ id:'missing',place:1,knockouts:0 },{ id:'missing-2',place:2,knockouts:0 }],
      null,
      [],
    ];
    for (let index=0; index<variants.length; index++) {
      const tournament = seedTournament(`invalid-basic-${index}`);
      const value = index===0 ? variants[index] : variants[index];
      expect((await rpc('club_close_tournament',admin,{p_request_id:randomUUID(),p_tournament_id:tournament,p_results:value})).status)
        .toBeGreaterThanOrEqual(400);
    }
    const mutations = [
      (rows: Record<string,unknown>[]) => rows.slice(0,1),
      (rows: Record<string,unknown>[]) => rows.map((row) => ({...row,place:1})),
      (rows: Record<string,unknown>[]) => [{...rows[0],id:'unknown'},rows[1]],
      (rows: Record<string,unknown>[]) => [{...rows[0],place:1.5},rows[1]],
      (rows: Record<string,unknown>[]) => [{...rows[0],knockouts:-1},rows[1]],
      (rows: Record<string,unknown>[]) => [{...rows[0],rubies:999999},rows[1]],
    ];
    for (let index=0; index<mutations.length; index++) {
      const tournament = seedTournament(`invalid-${index}`);
      const changed = mutations[index](results(tournament));
      expect((await rpc('club_close_tournament',admin,{p_request_id:randomUUID(),p_tournament_id:tournament,p_results:changed})).status)
        .toBeGreaterThanOrEqual(400);
      expect(localSql(`select is_closed from public.tournaments where id='${tournament}';`)).toBe('f');
    }
    const tournament = seedTournament('forged-args');
    expect((await rpc('club_close_tournament',admin,{p_request_id:randomUUID(),p_tournament_id:tournament,
      p_results:results(tournament),p_ruby_total:999999})).status).toBe(404);
  });

  it('rolls back every result, wallet, flag and receipt when audit insertion fails', async () => {
    const tournament = seedTournament('rollback');
    const before = localSql(`select md5(jsonb_build_object('t',to_jsonb(t),'p',
      (select jsonb_agg(to_jsonb(p) order by p.id) from public.participants p where p.tournament_id=t.id),
      'u',(select jsonb_agg(to_jsonb(u) order by u.id) from public.users u where u.id in ('${id('p1')}','${id('p2')}')))::text)
      from public.tournaments t where t.id='${tournament}';`);
    localSql(`create or replace function public.closure_test_fail_log() returns trigger language plpgsql as $$ begin
      if new.target_tournament_id='${tournament}' then raise exception 'Synthetic audit failure'; end if; return new; end $$;
      create trigger closure_test_fail_log before insert on public.logs for each row execute function public.closure_test_fail_log();`);
    try {
      const requestId=randomUUID();
      expect((await rpc('club_close_tournament',admin,{p_request_id:requestId,p_tournament_id:tournament,p_results:results(tournament)})).status)
        .toBeGreaterThanOrEqual(400);
      expect(localSql(`select md5(jsonb_build_object('t',to_jsonb(t),'p',
        (select jsonb_agg(to_jsonb(p) order by p.id) from public.participants p where p.tournament_id=t.id),
        'u',(select jsonb_agg(to_jsonb(u) order by u.id) from public.users u where u.id in ('${id('p1')}','${id('p2')}')))::text)
        from public.tournaments t where t.id='${tournament}';`)).toBe(before);
      expect(localSql(`select count(*) from club_private.tournament_close_requests where request_id='${requestId}';`)).toBe('0');
    } finally {
      localSql('drop trigger closure_test_fail_log on public.logs; drop function public.closure_test_fail_log();');
    }
  });
});
