import { beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';

const base = 'http://127.0.0.1:55430';
const prefix = `cashier-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;
function fixtureToken(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, aud: 'authenticated',
    iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })}`;
  return `${unsigned}.${createHmac('sha256', 'showdown-local-test-signing-key-never-use-in-production')
    .update(unsigned).digest('base64url')}`;
}
const anon = fixtureToken('anon');
const service = fixtureToken('service_role');
const voidMigration = () => readFileSync('supabase/migrations/20260903_transaction_voids.sql', 'utf8');
const hoursMigration = () => readFileSync('supabase/migrations/20260903_registered_dealer_hours.sql', 'utf8') + '\n' + voidMigration();
const migration = () => readFileSync('supabase/migrations/20260903_finance_commands.sql', 'utf8') + '\n' + hoursMigration();
async function rpc(name: string, access: string, args: object) {
  return fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args) });
}
function charge(overrides: Record<string, unknown> = {}) {
  return { p_request_id: randomUUID(), p_user_id: id('user'), p_tournament_id: id('event'),
    p_type: 'buy-in', p_comment: '', ...overrides };
}
function hours(overrides: Record<string, unknown> = {}) {
  return { p_request_id: randomUUID(), p_user_id: id('user'), p_tournament_id: id('no-addon'), p_delta: 0.5, ...overrides };
}
async function login(name: string) {
  localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at)
    values ('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes');`);
  const result = await verifyOtpAndIssueSession({ supabaseUrl: base, serviceRoleKey: service }, email(name), 'synthetic-hmac');
  expect(result.verified).toBe(true);
  if (!result.verified) throw new Error('Synthetic sign-in failed');
  expect((await rpc('club_open_session', result.session.access_token, {})).status).toBe(200);
  return result.session.access_token;
}

describe('isolated cashier commands: authorization, idempotency and atomic audit', () => {
  let admin = '';
  let owner = '';
  let user = '';
  beforeAll(async () => {
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql', 'utf8'));
    localSql(readFileSync('supabase/schema.sql', 'utf8'));
    localSql(readFileSync('supabase/migrations/20260829_login_otp.sql', 'utf8'));
    localSql(`insert into public.users(id,email,nickname,is_admin,ruby_balance) values
      ('${id('admin')}','${email('admin')}','Synthetic cashier',true,1234),
      ('${id('owner')}','${email('owner')}','Synthetic owner',true,2345),
      ('${id('user')}','${email('user')}','Synthetic player',false,3456);
      insert into public.tournaments(id,title,start_date,features) values
      ('${id('event')}','Synthetic event',current_date,array['Аддон']),
      ('${id('no-addon')}','Synthetic event without addon',current_date,'{}');
      insert into public.transactions(id,tournament_id,user_id,type,amount,status,dealer_hours,is_dealer,updated_at)
      values ('${id('legacy')}','${id('event')}','${id('user')}','buy-in',1000,'paid',2.5,true,'2026-08-01T12:00:00Z');`);
    localSql(readFileSync('supabase/migrations/20260903_auth_foundation.sql', 'utf8'));
    localSql(migration());
    localSql(migration());
    // Synthetic owner fixture only; no real account is chosen or changed.
    localSql(`update club_private.profile_roles set role='superadmin' where user_id='${id('owner')}';`);
    for (let attempt=0; attempt<20; attempt++) {
      if ((await rpc('club_create_charge', anon, charge())).status !== 404) break;
      await new Promise((resolve) => setTimeout(resolve,100));
    }
    [admin,owner,user] = await Promise.all([login('admin'),login('owner'),login('user')]);
  });

  it('preserves legacy profiles, admin flags, balances and recorded payments on migration rerun', () => {
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance)
      from public.users where id like '${prefix}%';`)).toBe('3|2|7035');
    expect(localSql(`select amount,status,dealer_hours,updated_at='2026-08-01T12:00:00Z'::timestamptz
      from public.transactions where id='${id('legacy')}';`)).toBe('1000|paid|2.5|t');
  });
  it('denies anon and ordinary users both financial commands', async () => {
    for (const access of [anon,user]) {
      expect([401,403]).toContain((await rpc('club_create_charge',access,charge())).status);
      expect([401,403]).toContain((await rpc('club_mark_paid',access,{ p_transaction_ids: [id('legacy')] })).status);
      expect([401,403]).toContain((await rpc('club_void_transaction',access,{ p_transaction_id:id('legacy'),p_reason:'Synthetic correction' })).status);
    }
  });
  it('does not accept client prices, paid status, actor IDs or timestamps', async () => {
    for (const extra of [{ p_amount: 1 }, { p_status: 'paid' }, { p_admin_id: id('owner') }, { p_date: '2000-01-01' }]) {
      expect((await rpc('club_create_charge',admin,charge(extra))).status).toBe(404);
    }
  });
  it('uses the existing server tariff for charges and zero for a paid ticket', async () => {
    for (const type of ['buy-in','rebuy','addon','ticket']) {
      const res = await rpc('club_create_charge',admin,charge({ p_type: type, p_comment: type==='ticket' ? ' Test ticket ' : '' }));
      expect(res.status).toBe(200);
      const tx = await res.json();
      expect(tx.amount).toBe(type==='ticket' ? 0 : 1000);
      expect(tx.status).toBe(type==='ticket' ? 'paid' : 'unpaid');
      expect(tx.comment).toBe(type==='ticket' ? 'Test ticket' : '');
      expect(tx.dealer_hours).toBe(2.5);
      expect(tx.is_dealer).toBe(true);
      expect(Math.abs(Date.now()-Date.parse(tx.date))).toBeLessThan(30000);
      expect(localSql(`select count(*) from public.logs where admin_id='${id('admin')}'
        and target_user_id='${id('user')}' and details::jsonb->>'transaction_id'='${tx.id}';`)).toBe('1');
    }
  });
  it('validates types, identity, request IDs, comment length and the addon rule', async () => {
    for (const change of [{ p_type: 'other' }, { p_user_id: id('missing') }, { p_tournament_id: id('missing') },
      { p_request_id: null }, { p_type: null }, { p_user_id: null }, { p_tournament_id: '' },
      { p_type: 'ticket', p_comment: 'x'.repeat(1001) }, { p_comment: 'unexpected' },
      { p_type: 'addon', p_tournament_id: id('no-addon') }]) {
      expect((await rpc('club_create_charge',admin,charge(change))).status).toBe(400);
    }
  });
  it('serializes concurrent repetitions and writes one charge, receipt and log', async () => {
    const args = charge();
    const responses = await Promise.all([rpc('club_create_charge',admin,args),rpc('club_create_charge',admin,args),rpc('club_create_charge',admin,args)]);
    expect(responses.map((res) => res.status)).toEqual([200,200,200]);
    const rows = await Promise.all(responses.map((res) => res.json()));
    expect(new Set(rows.map((row) => row.id)).size).toBe(1);
    expect(localSql(`select count(*) from club_private.finance_requests where actor_id='${id('admin')}'
      and request_id='${args.p_request_id}';`)).toBe('1');
    expect(localSql(`select count(*) from public.logs where target_tournament_id='${id('event')}'
      and details::jsonb->>'transaction_id'='${rows[0].id}';`)).toBe('1');
    expect((await rpc('club_create_charge',admin,{ ...args, p_type:'rebuy' })).status).toBe(400);
    expect((await rpc('club_mark_paid',admin,{ p_transaction_ids: [rows[0].id] })).status).toBe(200);
    const replay = await rpc('club_create_charge',admin,args);
    expect((await replay.json()).status).toBe('paid');
  });
  it('allows SuperAdmin through the same constrained command', async () => {
    const res = await rpc('club_create_charge',owner,charge());
    expect(res.status).toBe(200);
    const tx = await res.json();
    expect(tx.amount).toBe(1000);
    expect(localSql(`select admin_id from public.logs where target_tournament_id='${id('event')}'
      and details::jsonb->>'transaction_id'='${tx.id}';`)).toBe(id('owner'));
  });
  it('checks the whole payment batch before changing anything', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge())).json();
    for (const ids of [[tx.id,id('missing')], [tx.id,null], Array(501).fill(tx.id)]) {
      expect((await rpc('club_mark_paid',admin,{ p_transaction_ids:ids })).status).toBe(400);
    }
    expect(localSql(`select status,updated_at is null from public.transactions where id='${tx.id}';`)).toBe('unpaid|t');
    expect((await rpc('club_mark_paid',admin,{ p_transaction_ids:[] })).status).toBe(200);
  });
  it('makes concurrent payment batches atomic and does not repeat audit or move the payment date', async () => {
    const tx1 = await (await rpc('club_create_charge',admin,charge())).json();
    const tx2 = await (await rpc('club_create_charge',admin,charge())).json();
    const results = await Promise.all([
      rpc('club_mark_paid',admin,{ p_transaction_ids:[tx1.id,tx2.id,tx1.id] }),
      rpc('club_mark_paid',owner,{ p_transaction_ids:[tx2.id,tx1.id] }),
    ]);
    expect(results.map((res) => res.status)).toEqual([200,200]);
    const rows = await results[0].json();
    const repeat = await (await rpc('club_mark_paid',admin,{ p_transaction_ids:[tx1.id,tx2.id] })).json();
    expect(repeat).toEqual(rows);
    expect(rows.every((row: {status: string; updated_at: string}) => row.status==='paid' && row.updated_at)).toBe(true);
    expect(localSql(`select count(*) from public.logs where target_tournament_id='${id('event')}'
      and action_type='Погасил долг' and details::jsonb->>'transaction_id' in ('${tx1.id}','${tx2.id}');`)).toBe('2');
  });
  it('rolls back the financial write and receipt if the server audit cannot be saved', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge())).json();
    const args = charge();
    localSql(`create or replace function club_private.test_finance_audit_failure()
      returns trigger language plpgsql as $$ begin
        if new.target_tournament_id='${id('event')}' then raise exception 'Synthetic audit failure'; end if;
        return new; end $$;
      create trigger test_finance_audit_failure before insert on public.logs
      for each row execute function club_private.test_finance_audit_failure();`);
    try {
      const before = localSql(`select count(*) from public.transactions where tournament_id='${id('event')}';`);
      expect((await rpc('club_create_charge',admin,args)).ok).toBe(false);
      expect(localSql(`select count(*) from public.transactions where tournament_id='${id('event')}';`)).toBe(before);
      expect(localSql(`select count(*) from club_private.finance_requests where request_id='${args.p_request_id}';`)).toBe('0');
      expect((await rpc('club_mark_paid',admin,{ p_transaction_ids:[tx.id] })).ok).toBe(false);
      expect(localSql(`select status,updated_at is null from public.transactions where id='${tx.id}';`)).toBe('unpaid|t');
      const change = hours({ p_tournament_id:id('event') });
      expect((await rpc('club_adjust_dealer_hours',admin,change)).ok).toBe(false);
      expect(localSql(`select hours,revision,logged_at is null from club_private.dealer_hours
        where tournament_id='${id('event')}' and user_id='${id('user')}';`)).toBe('2.5|0|t');
      expect(localSql(`select count(*) from club_private.dealer_hour_requests where request_id='${change.p_request_id}';`)).toBe('0');
      expect(localSql(`select dealer_hours from public.transactions where id='${tx.id}';`)).toBe('2.5');
      expect((await rpc('club_void_transaction',admin,{p_transaction_id:tx.id,p_reason:'Synthetic correction'})).ok).toBe(false);
      expect(localSql(`select count(*) from club_private.transaction_voids where transaction_id='${tx.id}';`)).toBe('0');
      expect(localSql(`select status,updated_at is null from public.transactions where id='${tx.id}';`)).toBe('unpaid|t');
    } finally {
      // Remove only this test's synthetic failure injector, never business rows.
      localSql(`drop trigger test_finance_audit_failure on public.logs;
        drop function club_private.test_finance_audit_failure();`);
    }
    expect((await rpc('club_create_charge',admin,args)).status).toBe(200);
  });
  it('rejects a previously issued admin token after role revocation', async () => {
    localSql(`update club_private.profile_roles set role='user' where user_id='${id('admin')}';`);
    try {
      expect((await rpc('club_create_charge',admin,charge())).status).toBe(403);
      expect((await rpc('club_mark_paid',admin,{ p_transaction_ids:[id('legacy')] })).status).toBe(403);
      expect((await rpc('club_adjust_dealer_hours',admin,hours())).status).toBe(403);
      expect((await rpc('club_void_transaction',admin,{p_transaction_id:id('legacy'),p_reason:'Synthetic correction'})).status).toBe(403);
    } finally {
      localSql(`update club_private.profile_roles set role='admin' where user_id='${id('admin')}';`);
    }
  });
  it('keeps private receipts/helpers inaccessible and preserves financial rows on migration rerun', () => {
    expect(localSql(`select has_table_privilege('anon','club_private.finance_requests','SELECT,INSERT,UPDATE,DELETE'),
      has_table_privilege('authenticated','club_private.finance_requests','SELECT,INSERT,UPDATE,DELETE'),
      has_function_privilege('authenticated','club_private.require_finance_admin()','EXECUTE');`)).toBe('f|f|f');
    const before = localSql(`select count(*),sum(amount) from public.transactions where tournament_id='${id('event')}';`);
    localSql(migration());
    expect(localSql(`select count(*),sum(amount) from public.transactions where tournament_id='${id('event')}';`)).toBe(before);
  });

  it('stores hours before any charge exists and restores them through the server snapshot', async () => {
    const res = await rpc('club_adjust_dealer_hours',admin,hours());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ hours:0.5, revision:1, user_id:id('user') });
    expect(localSql(`select count(*) from public.transactions where tournament_id='${id('no-addon')}';`)).toBe('0');
    const snapshot = await (await rpc('club_finance_snapshot',user,{})).json();
    expect(snapshot.dealer_hours.find((row: {tournament_id:string}) => row.tournament_id===id('no-addon')).hours).toBe(0.5);
  });
  it('does not reapply simultaneous repetitions or accept a different delta with the same operation ID', async () => {
    const args = hours();
    const results = await Promise.all(Array.from({length:3},()=>rpc('club_adjust_dealer_hours',admin,args)));
    expect(results.map((res)=>res.status)).toEqual([200,200,200]);
    for (const res of results) expect(await res.json()).toMatchObject({ hours:1,revision:2 });
    expect(localSql(`select count(*) from club_private.dealer_hour_requests where request_id='${args.p_request_id}';`)).toBe('1');
    expect((await rpc('club_adjust_dealer_hours',admin,{ ...args,p_delta:-0.5 })).status).toBe(400);
  });
  it('retains all simultaneous increments from two administrators', async () => {
    const results = await Promise.all([rpc('club_adjust_dealer_hours',admin,hours()),
      rpc('club_adjust_dealer_hours',owner,hours()),rpc('club_adjust_dealer_hours',admin,hours())]);
    expect(results.map((res)=>res.status)).toEqual([200,200,200]);
    expect(localSql(`select hours,revision from club_private.dealer_hours
      where tournament_id='${id('no-addon')}' and user_id='${id('user')}';`)).toBe('2.5|5');
  });
  it('serializes the first charge with a simultaneous hours change', async () => {
    const results = await Promise.all([
      rpc('club_create_charge',admin,charge({p_tournament_id:id('no-addon')})),
      rpc('club_adjust_dealer_hours',owner,hours()),
    ]);
    expect(results.map((res)=>res.status)).toEqual([200,200]);
    const snapshot = await (await rpc('club_finance_snapshot',admin,{})).json();
    const txs = snapshot.transactions.filter((row: {tournament_id:string})=>row.tournament_id===id('no-addon'));
    expect(txs.length).toBe(1);
    expect(txs[0].dealer_hours).toBe(3);
    expect(txs[0].is_dealer).toBe(true);
  });
  it('never goes negative and remembers a no-op decrement even after a later increment', async () => {
    const noop = hours({p_user_id:id('owner'),p_delta:-0.5});
    expect(await (await rpc('club_adjust_dealer_hours',admin,noop)).json()).toMatchObject({hours:0,revision:0,logged_at:null});
    expect(await (await rpc('club_adjust_dealer_hours',admin,hours({p_user_id:id('owner')}))).json()).toMatchObject({hours:0.5,revision:1});
    expect(await (await rpc('club_adjust_dealer_hours',admin,noop)).json()).toMatchObject({hours:0.5,revision:1});
  });
  it('reads only the member own finances and denies anonymous snapshots and non-admin changes', async () => {
    expect((await rpc('club_create_charge',admin,charge({p_user_id:id('owner')}))).status).toBe(200);
    for (const access of [anon,user]) {
      expect([401,403]).toContain((await rpc('club_adjust_dealer_hours',access,hours())).status);
    }
    expect([401,403]).toContain((await rpc('club_finance_snapshot',anon,{})).status);
    expect((await rpc('club_finance_snapshot',fixtureToken('authenticated'),{})).status).toBe(403);
    const own = await (await rpc('club_finance_snapshot',user,{})).json();
    expect(own.transactions.length).toBeGreaterThan(0);
    expect([...own.transactions,...own.dealer_hours].every((row:{user_id:string})=>row.user_id===id('user'))).toBe(true);
    const all = await (await rpc('club_finance_snapshot',admin,{})).json();
    expect(all.transactions.some((row:{user_id:string})=>row.user_id===id('owner'))).toBe(true);
    expect((await rpc('club_finance_snapshot',user,{p_user_id:id('owner')})).status).toBe(404);
  });
  it('rejects invalid deltas, unknown targets and client-assigned totals or timestamps', async () => {
    for (const delta of [0,1,-1,0.1,null,'NaN','Infinity']) {
      expect((await rpc('club_adjust_dealer_hours',admin,hours({p_delta:delta}))).status).toBe(400);
    }
    for (const extra of [{p_hours:999},{p_logged_at:'2000-01-01'},{p_admin_id:id('owner')}]) {
      expect((await rpc('club_adjust_dealer_hours',admin,hours(extra))).status).toBe(404);
    }
    for (const extra of [{p_request_id:null},{p_user_id:id('missing')},{p_tournament_id:id('missing')}]) {
      expect((await rpc('club_adjust_dealer_hours',admin,hours(extra))).status).toBe(400);
    }
  });
  it('updates legacy hour projections without changing the payment date, amount or admin flags', async () => {
    const res = await rpc('club_adjust_dealer_hours',admin,hours({p_tournament_id:id('event')}));
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result).toMatchObject({hours:3,revision:1});
    expect(Number.isFinite(Date.parse(result.logged_at))).toBe(true);
    expect(localSql(`select dealer_hours,amount,status,updated_at='2026-08-01T12:00:00Z'::timestamptz
      from public.transactions where id='${id('legacy')}';`)).toBe('3.0|1000|paid|t');
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance)
      from public.users where id like '${prefix}%';`)).toBe('3|2|7035');
    // An old ledger value must not overwrite an existing canonical correction on rerun.
    localSql(hoursMigration());
    expect(localSql(`select hours,revision from club_private.dealer_hours
      where tournament_id='${id('event')}' and user_id='${id('user')}';`)).toBe('3.0|1');
  });
  it('keeps canonical hours, receipts and internal helpers unavailable to client roles', () => {
    expect(localSql(`select has_table_privilege('authenticated','club_private.dealer_hours','SELECT,INSERT,UPDATE,DELETE'),
      has_table_privilege('anon','club_private.dealer_hour_requests','SELECT,INSERT,UPDATE,DELETE'),
      has_function_privilege('authenticated','club_private.lock_dealer_hours(text,text)','EXECUTE');`)).toBe('f|f|f');
  });

  it('voids an unpaid entry without deleting or modifying the original financial row', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge())).json();
    const before = localSql(`select to_jsonb(t)::text from public.transactions t where id='${tx.id}';`);
    const res = await rpc('club_void_transaction',admin,{p_transaction_id:tx.id,p_reason:'  Duplicate entry  '});
    expect(res.status).toBe(200);
    const cancelled = await res.json();
    expect(cancelled).toMatchObject({id:tx.id,amount:1000,status:'unpaid',void_reason:'Duplicate entry'});
    expect(Number.isFinite(Date.parse(cancelled.voided_at))).toBe(true);
    expect(localSql(`select to_jsonb(t)::text from public.transactions t where id='${tx.id}';`)).toBe(before);
    expect(localSql(`select v.actor_id,v.original_record=to_jsonb(t) from club_private.transaction_voids v
      join public.transactions t on t.id=v.transaction_id where t.id='${tx.id}';`)).toBe(id('admin')+'|t');
    expect(localSql(`select count(*) from public.logs where action_type='Отменил финансовую запись'
      and target_tournament_id='${id('event')}' and details::jsonb->>'transaction_id'='${tx.id}';`)).toBe('1');
  });
  it('retains a paid record amount, original payment date and status when cancelling the ledger entry', async () => {
    const res = await rpc('club_void_transaction',owner,{p_transaction_id:id('legacy'),p_reason:'Synthetic correction, no refund'});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({id:id('legacy'),status:'paid',amount:1000});
    expect(localSql(`select amount,status,updated_at='2026-08-01T12:00:00Z'::timestamptz
      from public.transactions where id='${id('legacy')}';`)).toBe('1000|paid|t');
    expect(localSql(`select count(*) from public.logs where action_type='Отменил финансовую запись'
      and target_tournament_id='${id('event')}' and details::jsonb->>'transaction_id'='${id('legacy')}'
      and details::jsonb->>'refund_performed'='false';`)).toBe('1');
  });
  it('retains a cancelled ticket and its original description', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge({p_type:'ticket',p_comment:'Synthetic ticket'}))).json();
    const res = await rpc('club_void_transaction',admin,{p_transaction_id:tx.id,p_reason:'Wrong ticket'});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({id:tx.id,type:'ticket',status:'paid',amount:0,comment:'Synthetic ticket'});
    expect(localSql(`select count(*) from public.transactions where id='${tx.id}';`)).toBe('1');
  });
  it('makes concurrent cancellations and retries immutable and records only the first actor/reason', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge())).json();
    const responses = await Promise.all([
      rpc('club_void_transaction',admin,{p_transaction_id:tx.id,p_reason:'First candidate'}),
      rpc('club_void_transaction',owner,{p_transaction_id:tx.id,p_reason:'Second candidate'}),
    ]);
    expect(responses.map((res)=>res.status)).toEqual([200,200]);
    const first = await responses[0].json();
    expect(await responses[1].json()).toEqual(first);
    const repeat = await rpc('club_void_transaction',admin,{p_transaction_id:tx.id,p_reason:'Do not replace original reason'});
    expect(await repeat.json()).toEqual(first);
    expect(localSql(`select count(*) from public.logs where action_type='Отменил финансовую запись'
      and target_tournament_id='${id('event')}' and details::jsonb->>'transaction_id'='${tx.id}';`)).toBe('1');
  });
  it('rejects a payment batch containing a cancelled entry without partially paying another entry', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge())).json();
    expect((await rpc('club_mark_paid',admin,{p_transaction_ids:[tx.id,id('legacy')]})).status).toBe(400);
    expect(localSql(`select status,updated_at is null from public.transactions where id='${tx.id}';`)).toBe('unpaid|t');
  });
  it('serializes payment racing with cancellation and always retains a cancelled final entry', async () => {
    const tx = await (await rpc('club_create_charge',admin,charge())).json();
    const [paid,cancelled] = await Promise.all([
      rpc('club_mark_paid',admin,{p_transaction_ids:[tx.id]}),
      rpc('club_void_transaction',owner,{p_transaction_id:tx.id,p_reason:'Racing correction'}),
    ]);
    expect([200,400]).toContain(paid.status);
    expect(cancelled.status).toBe(200);
    const final = await (await rpc('club_finance_snapshot',admin,{})).json();
    const row = final.transactions.find((value:{id:string})=>value.id===tx.id);
    expect(Boolean(row.voided_at)).toBe(true);
    expect(row.status).toBe(paid.status===200 ? 'paid' : 'unpaid');
  });
  it('does not reactivate a cancelled transaction on a repeated creation request', async () => {
    const args = charge();
    const tx = await (await rpc('club_create_charge',admin,args)).json();
    expect((await rpc('club_void_transaction',admin,{p_transaction_id:tx.id,p_reason:'Duplicate charge'})).status).toBe(200);
    const replay = await rpc('club_create_charge',admin,args);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({id:tx.id,void_reason:'Duplicate charge'});
    const own = await (await rpc('club_finance_snapshot',user,{})).json();
    const row = own.transactions.find((value:{id:string})=>value.id===tx.id);
    expect(Boolean(row.voided_at)).toBe(true);
    expect(row.void_reason).toBeNull();
  });
  it('requires a bounded reason and cannot accept a forged actor, date or status', async () => {
    for (const reason of ['', '   ', 'x'.repeat(1001), null]) {
      expect((await rpc('club_void_transaction',admin,{p_transaction_id:id('legacy'),p_reason:reason})).status).toBe(400);
    }
    expect((await rpc('club_void_transaction',admin,{p_transaction_id:id('missing'),p_reason:'Missing'})).status).toBe(400);
    for (const extra of [{p_actor_id:id('owner')},{p_voided_at:'2000-01-01'},{p_status:'unpaid'}]) {
      expect((await rpc('club_void_transaction',admin,{p_transaction_id:id('legacy'),p_reason:'Test',...extra})).status).toBe(404);
    }
  });
  it('preserves cancellation history, profiles and balances on migration rerun and keeps markers private', async () => {
    const before = localSql(`select count(*),sum(t.amount) from club_private.transaction_voids v
      join public.transactions t on t.id=v.transaction_id where t.tournament_id='${id('event')}';`);
    localSql(voidMigration());
    expect(localSql(`select count(*),sum(t.amount) from club_private.transaction_voids v
      join public.transactions t on t.id=v.transaction_id where t.tournament_id='${id('event')}';`)).toBe(before);
    expect(localSql(`select has_table_privilege('authenticated','club_private.transaction_voids','SELECT,INSERT,UPDATE,DELETE'),
      has_table_privilege('anon','club_private.transaction_voids','SELECT,INSERT,UPDATE,DELETE'),
      has_function_privilege('authenticated','club_private.finance_transaction_json(public.transactions,boolean)','EXECUTE');`)).toBe('f|f|f');
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance)
      from public.users where id like '${prefix}%';`)).toBe('3|2|7035');
  });
});
