import { beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';

const base = 'http://127.0.0.1:55430';
const prefix = `personnel-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;
function token(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, aud: 'authenticated',
    iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })}`;
  return `${unsigned}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production').update(unsigned).digest('base64url')}`;
}
const anon = token('anon');
const service = token('service_role');
const migration = () => readFileSync('supabase/migrations/20260903_personnel_commands.sql','utf8');
async function rpc(name: string, access: string, args: object = {}) {
  return fetch(`${base}/rest/v1/rpc/${name}`, { method:'POST', headers: {
    apikey:anon, Authorization:`Bearer ${access}`, 'Content-Type':'application/json',
  }, body:JSON.stringify(args) });
}
function command(action = 'add_dealer', values: object = { name:'Synthetic dealer',minutes:90 }, entryId: string | null = null) {
  return { p_request_id:randomUUID(),p_tournament_id:id('work'),p_action:action,p_values:values,p_entry_id:entryId };
}
async function login(name: string) {
  localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at)
    values('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes');`);
  const result = await verifyOtpAndIssueSession({ supabaseUrl:base,serviceRoleKey:service },email(name),'synthetic-hmac');
  expect(result.verified).toBe(true);
  if (!result.verified) throw new Error('Synthetic sign-in failed');
  expect((await rpc('club_open_session',result.session.access_token)).status).toBe(200);
  return result.session.access_token;
}
type Entry = { id: string; kind: string; data: { name: string; hours: number; minutes: number; comment?: string; loggedAt?: string; role?: string }; archived_at: string | null; archive_reason: string | null };
type Roster = { tournament_id: string; revision: number; entries: Entry[] };
async function accepted(access: string, args: ReturnType<typeof command>): Promise<Roster> {
  const response = await rpc('club_personnel_command',access,args);
  expect(response.status).toBe(200);
  return response.json();
}
async function snapshot(access: string): Promise<Roster[]> {
  const response = await rpc('club_personnel_snapshot',access);
  expect(response.status).toBe(200);
  return response.json();
}

describe('isolated personnel commands and non-destructive legacy transfer', () => {
  let admin = ''; let owner = ''; let user = '';
  beforeAll(async () => {
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8') + '\n'
      + readFileSync('supabase/schema.sql','utf8') + '\n'
      + readFileSync('supabase/migrations/20260829_login_otp.sql','utf8') + '\n'
      + `insert into public.users(id,email,nickname,is_admin,ruby_balance) values
        ('${id('admin')}','${email('admin')}','Synthetic admin',true,100),
        ('${id('owner')}','${email('owner')}','Synthetic owner',true,200),
        ('${id('user')}','${email('user')}','Same name',false,300);
        insert into public.tournaments(id,title,start_date,dealers,staff) values
        ('${id('legacy')}','Synthetic legacy',current_date,
          '[{"name":"Same name","hours":2,"minutes":60,"comment":"Old note","loggedAt":"2026-08-01T12:00:00Z","legacyExtra":"preserve"},
            {"name":"Same name","hours":1,"minutes":15}]',
          '[{"role":"Админ","name":"","hours":0,"minutes":0}]'),
        ('${id('work')}','Synthetic work',current_date,'[]','[]');
        insert into public.transactions(id,tournament_id,user_id,type,amount,status)
        values('${id('charge')}','${id('legacy')}','${id('user')}','buy-in',1000,'paid');\n`
      + readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8') + '\n'
      + readFileSync('supabase/migrations/20260903_finance_commands.sql','utf8') + '\n'
      + readFileSync('supabase/migrations/20260903_registered_dealer_hours.sql','utf8') + '\n'
      + readFileSync('supabase/migrations/20260903_transaction_voids.sql','utf8') + '\n'
      + migration());
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('owner')}';`);
    for (let attempt=0;attempt<20;attempt++) {
      if ((await rpc('club_personnel_snapshot',anon)).status!==404) break;
      await new Promise((resolve) => setTimeout(resolve,100));
    }
    [admin,owner,user] = await Promise.all([login('admin'),login('owner'),login('user')]);
  });

  it('preserves original arrays, duplicate names, empty staff slots and exact legacy hours', async () => {
    const legacy = (await snapshot(admin)).find((row) => row.tournament_id===id('legacy'))!;
    expect(legacy.revision).toBe(0);
    expect(legacy.entries).toHaveLength(3);
    expect(new Set(legacy.entries.map((entry) => entry.id)).size).toBe(3);
    expect(legacy.entries[0].data).toEqual({ name:'Same name',hours:2,minutes:60,comment:'Old note',loggedAt:'2026-08-01T12:00:00Z' });
    expect(legacy.entries[2].data).toEqual({ role:'Админ',name:'',hours:0,minutes:0 });
    expect(localSql(`select r.legacy_dealers=t.dealers,r.legacy_staff=t.staff,
      r.entries->0->'data'->>'legacyExtra',count(u.id),sum(u.ruby_balance)
      from club_private.personnel_rosters r join public.tournaments t on t.id=r.tournament_id
      cross join public.users u where r.tournament_id='${id('legacy')}' and u.id like '${prefix}%'
      group by r.tournament_id,t.id;`)).toBe('t|t|preserve|3|600');
  });
  it('denies anonymous access and ordinary-user writes; returns no staff details to a member', async () => {
    expect([401,403]).toContain((await rpc('club_personnel_snapshot',anon)).status);
    expect(await snapshot(user)).toEqual([]);
    for (const access of [anon,user]) expect([401,403]).toContain((await rpc('club_personnel_command',access,command())).status);
    expect(localSql(`select has_table_privilege('anon','club_private.personnel_rosters','SELECT'),
      has_table_privilege('authenticated','club_private.personnel_rosters','UPDATE'),
      has_table_privilege('authenticated','club_private.personnel_requests','INSERT'),
      has_function_privilege('authenticated','club_private.personnel_json(text)','EXECUTE'),
      has_function_privilege('authenticated','club_private.ensure_personnel_roster(text)','EXECUTE');`)).toBe('f|f|f|f|f');
  });
  it('adds staff and dealers using server identity/date and keeps same names as different records', async () => {
    const first = await accepted(admin,command('add_dealer',{ name:' Same name ',minutes:90 }));
    const second = await accepted(owner,command('add_staff',{ name:'Same name',role:' Дилер ',minutes:0 }));
    const dealer = first.entries.at(-1)!;
    const staff = second.entries.at(-1)!;
    expect(dealer.id).not.toBe(staff.id);
    expect(dealer.data).toMatchObject({ name:'Same name',hours:1,minutes:30 });
    expect(staff.data).toMatchObject({ name:'Same name',role:'Дилер',hours:0,minutes:0 });
    expect(Math.abs(Date.now()-Date.parse(dealer.data.loggedAt!))).toBeLessThan(30000);
    expect(localSql(`select count(*) from public.logs where admin_id='${id('owner')}'
      and details::jsonb->>'entry_id'='${staff.id}';`)).toBe('1');
  });
  it('rejects forged fields, identity, timestamps, invalid action and unbounded input', async () => {
    for (const values of [{ name:'',minutes:1 },{ name:'x'.repeat(201),minutes:1 },{ name:'Test',minutes:-1 },
      { name:'Test',minutes:600001 },{ name:'Test',minutes:0.5 },{ name:'Test',minutes:'60' },
      { name:'Test',minutes:60,actor_id:id('owner') },{ name:'Test',minutes:60,loggedAt:'2000-01-01' }]) {
      expect((await rpc('club_personnel_command',admin,command('add_dealer',values))).status).toBe(400);
    }
    for (const override of [{ p_request_id:null },{ p_action:'replace_all' },{ p_tournament_id:id('missing') },{ p_values:null },{ p_entry_id:randomUUID() }]) {
      expect((await rpc('club_personnel_command',admin,{ ...command(),...override })).status).toBe(400);
    }
    expect((await rpc('club_personnel_command',admin,{ ...command(),p_actor_id:id('owner') })).status).toBe(404);
  });
  it('serializes duplicate requests and concurrent deltas without losing either administrator change', async () => {
    const args = command('add_dealer',{ name:'Concurrent',minutes:60 });
    const [a,b] = await Promise.all([accepted(admin,args),accepted(admin,args)]);
    expect(a.revision).toBe(b.revision);
    const entry = a.entries.at(-1)!;
    expect(a.entries.filter((row) => row.id===entry.id)).toHaveLength(1);
    expect((await rpc('club_personnel_command',admin,{ ...args,p_values:{ name:'Changed',minutes:60 } })).status).toBe(400);
    await Promise.all([accepted(admin,command('adjust',{ delta:30 },entry.id)),accepted(owner,command('adjust',{ delta:30 },entry.id))]);
    const current = (await snapshot(admin)).find((row) => row.tournament_id===id('work'))!;
    expect(current.entries.find((row) => row.id===entry.id)!.data).toMatchObject({ hours:2,minutes:0 });
    expect(localSql(`select count(*) from public.logs where
      (case when action_type='Изменил запись персонала' then details::jsonb else '{}'::jsonb end)->>'entry_id'='${entry.id}';`)).toBe('3');
  });
  it('records floor-zero requests once so retry cannot subtract newly added hours', async () => {
    const created = await accepted(admin,command('add_staff',{ name:'Floor',role:'Test',minutes:0 }));
    const entry = created.entries.at(-1)!;
    const floor = command('adjust',{ delta:-30 },entry.id);
    await accepted(admin,floor);
    await accepted(owner,command('adjust',{ delta:30 },entry.id));
    const replay = await accepted(admin,floor);
    expect(replay.entries.find((row) => row.id===entry.id)!.data).toMatchObject({ hours:0,minutes:30 });
    expect((await rpc('club_personnel_command',admin,command('adjust',{ delta:60 },entry.id))).status).toBe(400);
    expect((await rpc('club_personnel_command',admin,command('adjust',{ delta:30 },randomUUID()))).status).toBe(400);
  });
  it('prevents a stale comment replacing a newer edit and keeps the logged hours date', async () => {
    const created = await accepted(admin,command('add_dealer',{ name:'Comments',minutes:75 }));
    const entry = created.entries.at(-1)!;
    const edited = await accepted(owner,command('comment',{ comment:' First edit ',revision:created.revision },entry.id));
    const stale = await rpc('club_personnel_command',admin,command('comment',{ comment:'Stale edit',revision:created.revision },entry.id));
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('PT409');
    expect(edited.entries.find((row) => row.id===entry.id)!.data).toMatchObject({ comment:'First edit',loggedAt:entry.data.loggedAt });
  });
  it('archives without deletion, preserves original hours and excludes subsequent changes', async () => {
    const add = command('add_dealer',{ name:'Archive',minutes:125 });
    const created = await accepted(admin,add);
    const entry = created.entries.at(-1)!;
    const archive = command('archive',{ reason:' Duplicate duty ' },entry.id);
    await accepted(admin,archive);
    const replay = await accepted(admin,archive);
    const archived = replay.entries.find((row) => row.id===entry.id)!;
    expect(archived.data).toEqual(entry.data);
    expect(archived.archive_reason).toBe('Duplicate duty');
    expect(archived.archived_at).toBeTruthy();
    expect((await accepted(admin,add)).entries.find((row) => row.id===entry.id)).toEqual(archived);
    expect((await rpc('club_personnel_command',owner,command('adjust',{ delta:30 },entry.id))).status).toBe(400);
    expect((await rpc('club_personnel_command',owner,command('archive',{ reason:'Rewrite' },entry.id))).status).toBe(400);
  });
  it('rejects a personnel ID from another tournament without changing either roster', async () => {
    const legacy = (await snapshot(admin)).find((row) => row.tournament_id===id('legacy'))!;
    expect((await rpc('club_personnel_command',admin,command('adjust',{ delta:30 },legacy.entries[0].id))).status).toBe(400);
    expect((await snapshot(admin)).find((row) => row.tournament_id===id('legacy'))).toEqual(legacy);
  });
  it('rolls back entry, revision, receipt and archive together when audit insertion fails', async () => {
    const created = await accepted(admin,command('add_dealer',{ name:'Audit failure',minutes:45 }));
    const entry = created.entries.at(-1)!;
    localSql(`create or replace function public.personnel_test_fail_log() returns trigger language plpgsql as $$ begin
      if new.target_tournament_id='${id('work')}' then raise exception 'Synthetic audit failure'; end if; return new; end $$;
      create trigger personnel_test_fail_log before insert on public.logs for each row execute function public.personnel_test_fail_log();`);
    try {
      for (const args of [command(),command('adjust',{ delta:30 },entry.id),command('archive',{ reason:'Test' },entry.id)]) {
        expect((await rpc('club_personnel_command',admin,args)).status).toBeGreaterThanOrEqual(400);
        expect(localSql(`select count(*) from club_private.personnel_requests where actor_id='${id('admin')}' and request_id='${args.p_request_id}';`)).toBe('0');
      }
      expect((await snapshot(admin)).find((row) => row.tournament_id===id('work'))).toEqual(created);
    } finally { localSql('drop trigger personnel_test_fail_log on public.logs; drop function public.personnel_test_fail_log();'); }
  });
  it('seeds a newly created tournament on first command and reruns without resetting IDs or history', async () => {
    localSql(`insert into public.tournaments(id,title,start_date) values('${id('new')}','New synthetic tournament',current_date);`);
    const before = await accepted(admin,{ ...command(),p_tournament_id:id('new') });
    const prior = await snapshot(admin);
    localSql(migration());
    const after = await snapshot(admin);
    expect(after.filter((row) => row.tournament_id.startsWith(prefix))).toEqual(prior.filter((row) => row.tournament_id.startsWith(prefix)));
    expect(after.find((row) => row.tournament_id===id('new'))).toEqual(before);
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance) from public.users where id like '${prefix}%';`)).toBe('3|2|600');
    expect(localSql(`select amount,status from public.transactions where id='${id('charge')}';`)).toBe('1000|paid');
  });
  it('aborts migration on unfamiliar legacy data without silently skipping or rewriting it', () => {
    localSql(`insert into public.tournaments(id,title,start_date,dealers) values('${id('malformed')}','Malformed synthetic fixture',current_date,'{"unexpected":true}');`);
    try {
      expect(() => localSql(migration())).toThrow();
      expect(localSql(`select dealers='{"unexpected":true}'::jsonb,
        not exists(select 1 from club_private.personnel_rosters where tournament_id='${id('malformed')}')
        from public.tournaments where id='${id('malformed')}';`)).toBe('t|t');
    } finally { localSql(`update public.tournaments set dealers='[]' where id='${id('malformed')}';`); }
  });
  it('rechecks the real role after administrator privileges are revoked', async () => {
    localSql(`update club_private.profile_roles set role='user' where user_id='${id('admin')}';`);
    try {
      expect((await rpc('club_personnel_command',admin,command())).status).toBe(403);
      expect(await snapshot(admin)).toEqual([]);
      expect((await rpc('club_personnel_command',owner,command())).status).toBe(200);
    } finally { localSql(`update club_private.profile_roles set role='admin' where user_id='${id('admin')}';`); }
  });
});
