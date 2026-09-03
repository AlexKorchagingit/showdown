import { beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';

const base = 'http://127.0.0.1:55430';
const prefix = `anon-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;
const fixture = `anon_probe_${randomUUID().replaceAll('-', '')}`;
const sqlFile = (name: string) => readFileSync(`supabase/${name}`, 'utf8');
const migration = () => sqlFile('migrations/20260904_anon_access.sql');
const policyMigration = () => sqlFile('migrations/20260904_authenticated_policies.sql');
function token(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, aud: 'authenticated', iss: 'supabase',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${unsigned}.${createHmac('sha256', 'showdown-local-test-signing-key-never-use-in-production').update(unsigned).digest('base64url')}`;
}
const anon = token('anon');
const service = token('service_role');
const tables = ['users', 'tournaments', 'participants', 'transactions', 'logs', 'timer_sessions', 'login_otp_requests'];
async function request(path: string, method = 'GET', access: string | null = anon, body?: object) {
  const headers: Record<string, string> = { apikey: anon, 'Content-Type': 'application/json' };
  if (access) headers.Authorization = `Bearer ${access}`;
  return fetch(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const rpc = (name: string, access = anon, args: object = {}) => request(`/rest/v1/rpc/${name}`, 'POST', access, args);
async function login(name: string) {
  localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at)
    values('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes');`);
  const result = await verifyOtpAndIssueSession({ supabaseUrl: base, serviceRoleKey: service }, email(name), 'synthetic-hmac');
  expect(result.verified).toBe(true);
  if (!result.verified) throw new Error('Synthetic sign-in failed');
  return result.session;
}
// Hashes only; fixture/profile contents and access tokens are never logged.
const sourceHash = () => localSql(`select md5(jsonb_build_array(
  (select jsonb_agg(to_jsonb(u) order by id) from public.users u where id like '${prefix}%'),
  (select jsonb_agg(to_jsonb(t) order by id) from public.tournaments t where id like '${prefix}%'),
  (select jsonb_agg(to_jsonb(t) order by id) from public.transactions t where id like '${prefix}%'),
  (select jsonb_agg(to_jsonb(r) order by user_id) from club_private.profile_roles r where user_id like '${prefix}%'))::text);`);
const remainingPrivileges = () => localSql(`select
  (select count(*) from pg_class where relnamespace='public'::regnamespace
    and case when relkind in ('r','p','v','m','f') then
      (has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege('anon',oid,'SELECT,INSERT,UPDATE,REFERENCES')) else false end),
  (select count(*) from pg_class where relnamespace='public'::regnamespace
    and case when relkind='S' then has_sequence_privilege('anon',oid,'USAGE,SELECT,UPDATE') else false end),
  (select count(*) from pg_proc where pronamespace='public'::regnamespace and has_function_privilege('anon',oid,'EXECUTE')),
  has_schema_privilege('anon','public','CREATE');`);

describe('anonymous access cutover, with the real Auth/OTP path still working', () => {
  let baseline = '';
  let admin = '';
  let user = ''; let owner = '';
  beforeAll(async () => {
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql', 'utf8') + '\n' + sqlFile('schema.sql') + '\n'
      + sqlFile('migrations/20260829_login_otp.sql') + '\n'
      + `insert into public.users(id,email,nickname,is_admin,ruby_balance) values
        ('${id('admin')}','${email('admin')}','Synthetic admin',true,4000),
        ('${id('other-admin')}','${email('other-admin')}','Synthetic other admin',true,2500),
        ('${id('user')}','${email('user')}','Synthetic player',false,6000);
      insert into public.tournaments(id,title,start_date) values('${id('event')}','Synthetic event',current_date);
      insert into public.transactions(id,tournament_id,user_id,type,amount,status)
        values('${id('charge')}','${id('event')}','${id('user')}','buy-in',1000,'paid');\n`
      + sqlFile('migrations/20260903_auth_foundation.sql') + '\n'
      + sqlFile('migrations/20260903_finance_commands.sql') + '\n'
      + sqlFile('migrations/20260903_registered_dealer_hours.sql') + '\n'
      + sqlFile('migrations/20260903_transaction_voids.sql') + '\n'
      + sqlFile('migrations/20260903_wallet_shop.sql'));
    // Reproduce legacy grants, including column ACLs, views and PUBLIC defaults.
    // Synthetic/local only. Applying the migration must close all of them.
    localSql(`grant all on public.users,public.tournaments,public.participants,public.transactions,public.logs to anon;
      grant select(email),update(ruby_balance) on public.users to public,anon;
      create view public.${fixture} as select id,email from public.users;
      grant select on public.${fixture} to public;
      create sequence public.${fixture}_seq;
      grant all on public.${fixture}_seq to anon;
      create function public.${fixture}() returns bigint language sql security definer set search_path='' as
        'select count(*) from public.users';
      grant execute on function public.${fixture}() to public;
      alter default privileges grant all on tables to public,anon;
      alter default privileges in schema public grant execute on functions to public,anon;`);
    localSql(migration());
    localSql(migration());
    localSql(policyMigration());
    localSql(policyMigration());
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('other-admin')}';`);
    baseline = sourceHash();
    for (let attempt = 0; attempt < 20; attempt++) {
      if ((await rpc('club_current_account')).status !== 404) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
  it('preserves complete fixture rows, IDs, recorded payments and both original administrators', () => {
    expect(sourceHash()).toBe(baseline);
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance) from public.users where id like '${prefix}%';`))
      .toBe('3|2|12500');
    expect(remainingPrivileges()).toBe('0|0|0|f');
  });
  it.each(tables)('denies anonymous reads from %s, including requests without a bearer token', async (table) => {
    for (const access of [anon, null]) {
      const result = await request(`/rest/v1/${table}?select=*&limit=1`, 'GET', access);
      expect([401, 403]).toContain(result.status);
      expect(Array.isArray(await result.json())).toBe(false);
    }
  });
  it.each(tables)('denies anonymous INSERT, UPDATE, DELETE and upsert on %s', async (table) => {
    const key = table === 'login_otp_requests' ? 'email' : 'id';
    const value = table === 'login_otp_requests' ? email('user') : id('user');
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const result = await request(`/rest/v1/${table}?${key}=eq.${value}`, method, anon,
        method === 'DELETE' ? undefined : { [key]: value });
      expect([401, 403]).toContain(result.status);
    }
    const result = await fetch(`${base}/rest/v1/${table}?on_conflict=${key}`, {
      method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ [key]: value }),
    });
    expect([401, 403]).toContain(result.status);
  });
  it('denies view, embedded relation and SECURITY DEFINER helper bypasses', async () => {
    for (const path of [`/rest/v1/${fixture}?select=*`, '/rest/v1/transactions?select=id,users(email)', `/rest/v1/rpc/${fixture}`]) {
      const result = await request(path, path.includes('/rpc/') ? 'POST' : 'GET', anon, path.includes('/rpc/') ? {} : undefined);
      expect([401, 403]).toContain(result.status);
    }
  });
  it('denies direct SQL SELECT, UPDATE, TRUNCATE and sequence access as anon', () => {
    const checks = ["select email from public.users limit 1", "update public.users set ruby_balance=ruby_balance where false",
      "truncate public.timer_sessions", `select nextval('public.${fixture}_seq')`];
    // If a denial regresses, even TRUNCATE affects only this rolled-back fixture transaction.
    const result = localSql(`begin; set local role anon;
      ${checks.map((query) => `do $test$ begin
        begin ${query}; raise exception 'Anonymous SQL unexpectedly succeeded';
        exception when insufficient_privilege then null; end;
      end; $test$;`).join('\n')}
      rollback;`);
    expect(result).toContain('ROLLBACK');
  });
  it('keeps future tables, sequences and functions closed, including formerly global defaults', () => {
    expect(localSql(`begin;
      create table public.${fixture}_future(id integer);
      create sequence public.${fixture}_future_seq;
      create function public.${fixture}_future() returns integer language sql as 'select 1';
      select has_table_privilege('anon','public.${fixture}_future','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
        has_sequence_privilege('anon','public.${fixture}_future_seq','USAGE,SELECT,UPDATE'),
        has_function_privilege('anon','public.${fixture}_future()','EXECUTE');
      rollback;`)).toContain('f|f|f');
  });
  it('rolls the whole migration back on inherited privileges, without modifying role membership', () => {
    localSql('grant authenticated to anon; grant select on public.users to anon;');
    try {
      expect(() => localSql(migration())).toThrow('Local Docker command failed');
      expect(localSql("select pg_has_role('anon','authenticated','MEMBER'), (select count(*) from aclexplode((select relacl from pg_class where oid='public.users'::regclass)) where grantee='anon'::regrole and privilege_type='SELECT');"))
        .toBe('t|1');
    } finally {
      localSql('revoke authenticated from anon; revoke all on public.users from anon;');
    }
    expect(remainingPrivileges()).toBe('0|0|0|f');
  });
  it('does not reopen anonymous access when either schema bootstrap is rerun', () => {
    localSql(sqlFile('schema.sql') + '\n' + sqlFile('timer-sessions.sql'));
    expect(remainingPrivileges()).toBe('0|0|0|f');
    expect(sourceHash()).toBe(baseline);
  });
  it('keeps server OTP available but denies direct anonymous OTP calls', async () => {
    for (const [name, args] of [
      ['issue_login_otp', { p_email: email('denied'), p_code_hash: 'synthetic', p_ip_hash: 'synthetic' }],
      ['verify_login_otp', { p_email: email('denied'), p_code_hash: 'synthetic' }],
      ['cancel_login_otp', { p_email: email('denied'), p_code_hash: 'synthetic' }],
    ] as const) expect([401, 403]).toContain((await rpc(name, anon, args)).status);
    admin = (await login('admin')).access_token;
    user = (await login('user')).access_token;
    for (const [access, role, profileId] of [[admin, 'admin', id('admin')], [user, 'user', id('user')]]) {
      const response = await rpc('club_open_session', access);
      expect(response.status).toBe(200);
      expect((await response.json()).user).toMatchObject({ id: profileId, role });
    }
    owner = (await login('other-admin')).access_token;
    expect((await rpc('club_open_session', owner)).status).toBe(200);
  });
  it('keeps consent, new profile creation and token refresh working without anonymous table grants', async () => {
    const session = await login('new');
    expect((await (await rpc('club_open_session', session.access_token)).json()).status).toBe('consent_required');
    const accepted = await rpc('club_open_session', session.access_token, { p_accept_agreements: true });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).user.role).toBe('user');
    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', 'POST', anon, { refresh_token: session.refresh_token });
    expect(refreshed.status).toBe(200);
    const next = await refreshed.json();
    expect((await rpc('club_current_account', next.access_token)).status).toBe(200);
  });
  it('keeps the directory, wallet purchase and cashier RPC working with personal sessions', async () => {
    expect((await rpc('club_directory', user)).status).toBe(200);
    expect((await rpc('club_wallet_snapshot', user)).status).toBe(200);
    const bought = await rpc('club_buy_item', user, { p_request_id: randomUUID(), p_item_id: 'char_cowboy', p_catalog_revision: 1 });
    expect(bought.status).toBe(200);
    expect((await bought.json()).wallet.ruby_balance).toBe(3000);
    const charge = { p_request_id: randomUUID(), p_tournament_id: id('event'), p_user_id: id('user'), p_type: 'buy-in' };
    expect((await rpc('club_create_charge', user, charge)).status).toBe(403);
    expect((await rpc('club_create_charge', admin, charge)).status).toBe(200);
    expect((await rpc('club_finance_snapshot', admin)).status).toBe(200);
  });
  it('enforces direct table policies for user, admin and SuperAdmin', async () => {
    const ownUsers = await request('/rest/v1/users?select=id', 'GET', user);
    expect(ownUsers.status).toBe(200);
    expect(await ownUsers.json()).toEqual([{ id:id('user') }]);
    const adminUsers = await request(`/rest/v1/users?select=id&id=like.${prefix}*`, 'GET', admin);
    expect((await adminUsers.json())).toHaveLength(3);

    for (const path of ['/rest/v1/transactions?select=id','/rest/v1/logs?select=id','/rest/v1/timer_sessions?select=id']) {
      const response = await request(path,'GET',user);
      expect(response.status).toBe(200);
      if (!path.includes('transactions')) expect(await response.json()).toEqual([]);
    }
    expect((await request('/rest/v1/logs?select=id','GET',admin)).status).toBe(200);
    expect((await request('/rest/v1/logs?select=id','GET',owner)).status).toBe(200);

    // PostgreSQL filters an unauthorized UPDATE to zero rows; PostgREST reports 204.
    expect((await request(`/rest/v1/tournaments?id=eq.${id('event')}`,'PATCH',user,{ about:'forged' })).status).toBe(204);
    expect(localSql(`select about from public.tournaments where id='${id('event')}';`)).toBe('');
    expect((await request(`/rest/v1/tournaments?id=eq.${id('event')}`,'PATCH',admin,{ about:'Synthetic policy check' })).status).toBe(204);
    expect(localSql(`select about from public.tournaments where id='${id('event')}';`)).toBe('Synthetic policy check');
    expect((await request('/rest/v1/participants','POST',user,
      { id:id('forged-seat'),tournament_id:id('event'),user_id:id('user'),nickname:'Synthetic player',rating:999 })).status).toBe(403);
    const seat = { id:id('own-seat'),tournament_id:id('event'),user_id:id('user'),nickname:'Synthetic player',rating:0 };
    expect((await request('/rest/v1/participants','POST',user,seat)).status).toBe(201);
    expect((await request(`/rest/v1/participants?id=eq.${id('own-seat')}`,'DELETE',user)).status).toBe(204);
    expect(localSql(`select count(*) from pg_policies where schemaname='public'
      and (coalesce(qual,'') ~ '^\\s*true\\s*$' or coalesce(with_check,'') ~ '^\\s*true\\s*$');`)).toBe('0');
  });
});
