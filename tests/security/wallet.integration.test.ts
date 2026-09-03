import { beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localSql } from '../../scripts/security-local.mjs';
import { verifyOtpAndIssueSession } from '../../supabase/functions/login-otp/session';
import { SHOP_ITEMS } from '../../src/data/shopItems';

const base = 'http://127.0.0.1:55430';
const prefix = `wallet-${randomUUID()}`;
const id = (name: string) => `${prefix}-${name}`;
const email = (name: string) => `${id(name)}@example.test`;
function token(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = `${encode({alg:'HS256',typ:'JWT'})}.${encode({role,aud:'authenticated',iss:'supabase',
    iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${payload}.${createHmac('sha256','showdown-local-test-signing-key-never-use-in-production').update(payload).digest('base64url')}`;
}
const anon = token('anon'); const service = token('service_role');
const migration = () => readFileSync('supabase/migrations/20260903_wallet_shop.sql','utf8');
async function rpc(name: string, access: string, args: object = {}) {
  return fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anon,
    Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
}
type WalletRow = {user_id:string;ruby_balance:number;revision:number;owned_items:string[];equipped_char:string;equipped_bg:string;
  equipped_avatar:string[];pending_notifications:Array<{id:string;amount:number;message:string}>;
  catalog:Array<{id:string;type:string;name:string;price:number;revision:number;active:boolean}>};
async function snapshot(access: string): Promise<WalletRow> {
  const response = await rpc('club_wallet_snapshot',access);
  expect(response.status).toBe(200);
  return response.json();
}
const purchase = (item = 'char_jester', overrides: object = {}) => ({p_request_id:randomUUID(),p_item_id:item,p_catalog_revision:1,...overrides});
async function buy(access: string, args = purchase()): Promise<WalletRow> {
  const response = await rpc('club_buy_item',access,args);
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.request_id).toBe(args.p_request_id);
  return data.wallet;
}
async function equip(access: string, item: string, requestId = randomUUID()): Promise<WalletRow> {
  const response = await rpc('club_equip_item',access,{p_request_id:requestId,p_item_id:item});
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.request_id).toBe(requestId);
  return data.wallet;
}
async function claim(access: string, notificationId: string): Promise<WalletRow> {
  const response = await rpc('club_claim_ruby_notification',access,{p_notification_id:notificationId});
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.notification_id).toBe(notificationId);
  return data.wallet;
}
async function login(name: string) {
  const result = await verifyOtpAndIssueSession({supabaseUrl:base,serviceRoleKey:service},email(name),'synthetic-hmac');
  expect(result.verified).toBe(true);
  if (!result.verified) throw new Error('Synthetic sign-in failed');
  expect((await rpc('club_open_session',result.session.access_token)).status).toBe(200);
  return result.session.access_token;
}
const sourceHash = () => localSql(`select md5(jsonb_agg(to_jsonb(u) order by u.id)::text) from public.users u where u.id like '${prefix}%';`);

describe('isolated shop and one-time wallet claims',() => {
  let buyer=''; let poor=''; let other=''; let admin=''; let baseline='';
  beforeAll(async () => {
    expect((await fetch(`${base}/auth/v1/health`)).status).toBe(200);
    localSql(readFileSync('tests/security/auth-helpers.sql','utf8')+'\n'+readFileSync('supabase/schema.sql','utf8')+'\n'
      +readFileSync('supabase/migrations/20260829_login_otp.sql','utf8')+'\n'
      +`insert into public.users(id,email,nickname,is_admin,ruby_balance,owned_items,pending_notifications) values
        ('${id('buyer')}','${email('buyer')}','Synthetic buyer',false,9000,
          array['legacy-special','cosmetics-reset-v2','char_base','bg_base'],
          '[{"id":"${id('bonus')}","message":"Legacy gift","amount":500,"legacyExtra":"preserve"},
            {"id":"${id('later')}","message":"Later gift","amount":100}]'),
        ('${id('poor')}','${email('poor')}','Synthetic small wallet',false,3000,array['char_base','bg_base'],'[]'),
        ('${id('other')}','${email('other')}','Synthetic other',false,6000,array['char_base','bg_base'],
          '[{"id":"${id('other-bonus')}","message":"Other gift","amount":250}]'),
        ('${id('admin')}','${email('admin')}','Synthetic admin',true,5000,array['char_base','bg_base'],'[]');\n`
      +readFileSync('supabase/migrations/20260903_auth_foundation.sql','utf8'));
    baseline=sourceHash();
    localSql(migration()); localSql(migration());
    for(let attempt=0;attempt<20;attempt++) {
      if((await rpc('club_wallet_snapshot',anon)).status!==404) break;
      await new Promise((resolve)=>setTimeout(resolve,100));
    }
    // Seed first; synchronous Docker must not consume in-flight Auth timeouts.
    localSql(`insert into public.login_otp_requests(email,code_hash,request_ip_hash,expires_at) values
      ${['buyer','poor','other','admin'].map((name) => `('${email(name)}','synthetic-hmac','synthetic-ip',now()+interval '5 minutes')`).join(',')};`);
    [buyer,poor,other,admin]=await Promise.all([login('buyer'),login('poor'),login('other'),login('admin')]);
  });
  it('does not reset balances, inventory, notifications, timestamps or administrator flags',async () => {
    expect(sourceHash()).toBe(baseline);
    const wallet=await snapshot(buyer);
    expect(wallet.ruby_balance).toBe(9000);
    expect(wallet.revision).toBe(0);
    expect(wallet.owned_items).toEqual(['legacy-special','cosmetics-reset-v2','char_base','bg_base']);
    expect(wallet.pending_notifications).toHaveLength(2);
    expect(localSql(`select count(*),count(*) filter(where is_admin),sum(ruby_balance) from public.users where id like '${prefix}%';`)).toBe('4|1|23000');
  });
  it('preserves every current catalog price/type/name and does not trust a supplied price',async () => {
    const wallet=await snapshot(buyer);
    expect(wallet.catalog.map(({id,type,name,price})=>({id,type,name,price})).sort((a,b)=>a.id.localeCompare(b.id)))
      .toEqual(SHOP_ITEMS.map(({id,type,name,price})=>({id,type,name,price})).sort((a,b)=>a.id.localeCompare(b.id)));
    for(const extra of [{p_price:1},{p_balance:99999},{p_user_id:id('other')},{p_actor_id:id('admin')},{p_date:'2000-01-01'}]) {
      expect((await rpc('club_buy_item',buyer,purchase('char_jester',extra))).status).toBe(404);
    }
  });
  it('denies anonymous RPCs and direct access to new private objects; snapshots are own-only',async () => {
    for(const [name,args] of [['club_wallet_snapshot',{}],['club_buy_item',purchase()],
      ['club_equip_item',{p_request_id:randomUUID(),p_item_id:'char_base'}],
      ['club_claim_ruby_notification',{p_notification_id:id('bonus')}]] as const) {
      expect([401,403]).toContain((await rpc(name,anon,args)).status);
    }
    expect((await snapshot(other)).user_id).toBe(id('other'));
    expect((await snapshot(admin)).user_id).toBe(id('admin'));
    expect((await rpc('club_wallet_snapshot',buyer,{p_user_id:id('other')})).status).toBe(404);
    expect(localSql(`select has_table_privilege('authenticated','club_private.shop_catalog','UPDATE'),
      has_table_privilege('anon','club_private.wallet_requests','SELECT'),
      has_table_privilege('authenticated','club_private.wallet_claims','INSERT'),
      has_table_privilege('authenticated','club_private.wallet_versions','UPDATE'),
      has_function_privilege('authenticated','club_private.shop_command(uuid,text,bigint,boolean)','EXECUTE'),
      has_function_privilege('authenticated','club_private.wallet_json(text)','EXECUTE');`)).toBe('f|f|f|f|f|f');
  });
  it('buys once across duplicate requests and tabs, preserves legacy inventory and equips the item',async () => {
    const args=purchase();
    await Promise.all([buy(buyer,args),buy(buyer,args),buy(buyer,purchase())]);
    const current=await snapshot(buyer);
    expect(current.ruby_balance).toBe(6000);
    expect(current.owned_items.filter((item)=>item==='char_jester')).toHaveLength(1);
    expect(current.owned_items).toContain('legacy-special');
    expect(current.equipped_char).toBe('char_jester');
    expect(current.equipped_avatar).toEqual(['/avatars/jester.png','char_jester','bg_base']);
    expect(current.pending_notifications).toHaveLength(2);
    expect(localSql(`select count(*) from public.logs where target_user_id='${id('buyer')}' and action_type='Купил предмет';`)).toBe('1');
    expect((await rpc('club_buy_item',buyer,{...args,p_item_id:'char_cowboy'})).status).toBe(400);
  });
  it('serializes different purchases and cannot overspend the same balance',async () => {
    const responses=await Promise.all([rpc('club_buy_item',poor,purchase('char_jester')),rpc('club_buy_item',poor,purchase('char_cowboy'))]);
    expect(responses.map((r)=>r.status).sort()).toEqual([200,402]);
    const current=await snapshot(poor);
    expect(current.ruby_balance).toBe(0);
    expect(current.owned_items.filter((item)=>['char_jester','char_cowboy'].includes(item))).toHaveLength(1);
    expect((await rpc('club_buy_item',poor,purchase('bg_2'))).status).toBe(402);
  });
  it('requires ownership and a valid item; free items do not charge; replays do not restore old appearance',async () => {
    expect((await rpc('club_equip_item',buyer,{p_request_id:randomUUID(),p_item_id:'char_king'})).status).toBe(403);
    const oldRequest=randomUUID();
    await equip(buyer,'char_base',oldRequest);
    await equip(buyer,'char_jester');
    const replay=await equip(buyer,'char_base',oldRequest);
    expect(replay.equipped_char).toBe('char_jester');
    expect(replay.ruby_balance).toBe(6000);
    const free=await buy(buyer,purchase('bg_base'));
    expect(free.ruby_balance).toBe(6000);
    for(const override of [{p_item_id:'missing'},{p_request_id:null},{p_catalog_revision:0},{p_catalog_revision:null}]) {
      expect((await rpc('club_buy_item',buyer,purchase('bg_2',override))).status).toBe(400);
    }
  });
  it('rejects stale price quotes and unavailable items; migration rerun does not overwrite catalog edits',async () => {
    localSql("update club_private.shop_catalog set price=1700,active=false where id='bg_11';");
    try {
      expect((await rpc('club_buy_item',buyer,purchase('bg_11'))).status).toBe(400);
      localSql(migration());
      expect(localSql("select price,active,revision>1 from club_private.shop_catalog where id='bg_11';")).toBe('1700|f|t');
      localSql("update club_private.shop_catalog set active=true where id='bg_11';");
      expect((await rpc('club_buy_item',buyer,purchase('bg_11'))).status).toBe(409);
      const current=await snapshot(buyer);
      const item=current.catalog.find((entry)=>entry.id==='bg_11')!;
      expect((await buy(buyer,purchase('bg_11',{p_catalog_revision:item.revision}))).ruby_balance).toBe(4300);
    } finally { localSql("update club_private.shop_catalog set price=1500,active=true where id='bg_11';"); }
  });
  it('claims an existing bonus once, preserves its original record and leaves other notifications untouched',async () => {
    await Promise.all([claim(buyer,id('bonus')),claim(buyer,id('bonus')),claim(buyer,id('bonus'))]);
    const wallet=await snapshot(buyer);
    expect(wallet.ruby_balance).toBe(4800);
    expect(wallet.pending_notifications).toEqual([{id:id('later'),message:'Later gift',amount:100}]);
    expect(localSql(`select original_notification->>'legacyExtra' from club_private.wallet_claims where user_id='${id('buyer')}' and notification_id='${id('bonus')}';`)).toBe('preserve');
    expect(localSql(`select count(*) from public.logs where target_user_id='${id('buyer')}' and action_type='Получил бонус';`)).toBe('1');
    expect((await rpc('club_claim_ruby_notification',other,{p_notification_id:id('bonus')})).status).toBe(400);
    expect((await rpc('club_claim_ruby_notification',buyer,{p_notification_id:id('other-bonus'),p_amount:100000})).status).toBe(404);
  });
  it('does not lose a simultaneous bonus credit and purchase debit',async () => {
    await Promise.all([claim(other,id('other-bonus')),buy(other,purchase('bg_2'))]);
    const current=await snapshot(other);
    expect(current.ruby_balance).toBe(4750);
    expect(current.owned_items).toContain('bg_2');
    expect(current.pending_notifications).toEqual([]);
  });
  it('rolls back balance, inventory, bonus, revision and receipts if audit insertion fails',async () => {
    const before=await snapshot(buyer);
    const args=purchase('bg_3');
    localSql(`create or replace function public.wallet_test_fail_log() returns trigger language plpgsql as $$ begin
      if new.target_user_id='${id('buyer')}' then raise exception 'Synthetic audit failure'; end if; return new; end $$;
      create trigger wallet_test_fail_log before insert on public.logs for each row execute function public.wallet_test_fail_log();`);
    try {
      expect((await rpc('club_buy_item',buyer,args)).status).toBeGreaterThanOrEqual(400);
      expect((await rpc('club_equip_item',buyer,{p_request_id:randomUUID(),p_item_id:'char_base'})).status).toBeGreaterThanOrEqual(400);
      expect((await rpc('club_claim_ruby_notification',buyer,{p_notification_id:id('later')})).status).toBeGreaterThanOrEqual(400);
      expect(await snapshot(buyer)).toEqual(before);
      expect(localSql(`select count(*) from club_private.wallet_requests where user_id='${id('buyer')}' and request_id='${args.p_request_id}';`)).toBe('0');
    } finally { localSql('drop trigger wallet_test_fail_log on public.logs; drop function public.wallet_test_fail_log();'); }
  });
  it('rejects malformed, ambiguous and overflowing legacy bonus records without altering them',async () => {
    localSql(`update public.users set pending_notifications='[
      {"id":"negative","message":"Synthetic invalid","amount":-1},
      {"id":"fraction","message":"Synthetic invalid","amount":0.5},
      {"id":"overflow","message":"Synthetic invalid","amount":2147483647},
      {"id":"duplicate","message":"One","amount":1},{"id":"duplicate","message":"Two","amount":2}]'
      where id='${id('admin')}';`);
    const before=await snapshot(admin);
    for(const notificationId of ['negative','fraction','overflow','duplicate','missing']) {
      expect((await rpc('club_claim_ruby_notification',admin,{p_notification_id:notificationId})).status).toBe(400);
    }
    expect(await snapshot(admin)).toEqual(before);
  });
  it('records legacy wallet changes in the revision without treating them as secure commands',async () => {
    const before=await snapshot(other);
    localSql(`update public.users set ruby_balance=ruby_balance+1 where id='${id('other')}';`);
    const after=await snapshot(other);
    expect(after.revision).toBe(before.revision+1);
    expect(after.ruby_balance).toBe(before.ruby_balance+1);
    const hash=sourceHash();
    localSql(migration());
    expect(sourceHash()).toBe(hash);
    expect(await snapshot(other)).toEqual(after);
    expect(localSql(`select count(*) filter(where is_admin) from public.users where id like '${prefix}%';`)).toBe('1');
  });
  it('rejects all wallet commands after the authenticated account is banned',async () => {
    localSql(`update auth.users set banned_until=now()+interval '1 hour' where email='${email('poor')}';`);
    try {
      expect((await rpc('club_wallet_snapshot',poor)).status).toBe(403);
      expect((await rpc('club_buy_item',poor,purchase('bg_4'))).status).toBe(403);
      expect((await rpc('club_equip_item',poor,{p_request_id:randomUUID(),p_item_id:'char_base'})).status).toBe(403);
      expect((await rpc('club_claim_ruby_notification',poor,{p_notification_id:id('later')})).status).toBe(403);
    } finally { localSql(`update auth.users set banned_until=null where email='${email('poor')}';`); }
  });
});
