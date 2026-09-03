-- Stage 2.2e: LOCAL ONLY. Requires auth foundation; legacy ACL/RLS cutover is pending.
-- No balance/inventory reset, no automatic notification claims, no user role changes.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.shop_catalog (
  id text primary key,
  item_type text not null check(item_type in ('character','bg')),
  name text not null,
  price integer not null check(price>=0),
  avatar_path text,
  active boolean not null default true,
  revision bigint not null default 1 check(revision>0)
);
insert into club_private.shop_catalog(id,item_type,name,price,avatar_path) values
  ('char_base','character','Базовый',0,'/avatars/default_cat.png'),
  ('char_jester','character','Шут',3000,'/avatars/jester.png'),
  ('char_cowboy','character','Ковбой',3000,'/avatars/cowboy.png'),
  ('char_knight','character','Рыцарь',3000,'/avatars/knight.png'),
  ('char_fortune','character','Гадалка',6000,'/avatars/fortune_teller.png'),
  ('char_mage','character','Маг',6000,'/avatars/mage.png'),
  ('char_villain','character','Злодей',12000,'/avatars/villain.png'),
  ('char_duchess','character','Герцогиня',12000,'/avatars/duchess.png'),
  ('char_baron','character','Барон',12000,'/avatars/baron.png'),
  ('char_king','character','Король',25000,'/avatars/king.png'),
  ('bg_base','bg','Базовый фон',0,null)
on conflict(id) do nothing;
insert into club_private.shop_catalog(id,item_type,name,price)
select 'bg_'||n,'bg','Фон '||(n-1),1500 from generate_series(2,11) n
on conflict(id) do nothing;

create table if not exists club_private.wallet_versions (
  user_id text primary key references public.users(id) on delete restrict,
  revision bigint not null default 0 check(revision>=0)
);
insert into club_private.wallet_versions(user_id) select id from public.users on conflict(user_id) do nothing;
create table if not exists club_private.wallet_requests (
  user_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  item_id text not null references club_private.shop_catalog(id) on delete restrict,
  payload jsonb not null,
  charged integer not null check(charged>=0),
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,request_id)
);
create table if not exists club_private.wallet_claims (
  user_id text not null references public.users(id) on delete restrict,
  notification_id text not null,
  original_notification jsonb not null,
  claimed_at timestamptz not null default clock_timestamp(),
  primary key(user_id,notification_id)
);
alter table club_private.shop_catalog enable row level security;
alter table club_private.wallet_versions enable row level security;
alter table club_private.wallet_requests enable row level security;
alter table club_private.wallet_claims enable row level security;
revoke all on club_private.shop_catalog,club_private.wallet_versions,club_private.wallet_requests,
  club_private.wallet_claims from public,anon,authenticated;

create or replace function club_private.advance_catalog_revision()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  new.revision := old.revision+1;
  return new;
end $$;
revoke all on function club_private.advance_catalog_revision() from public,anon,authenticated;
create or replace trigger club_catalog_revision before update on club_private.shop_catalog
for each row execute function club_private.advance_catalog_revision();

-- Track every wallet field update, including legacy grant paths until their own cutover.
-- No trigger runs on startup or migration; existing user rows stay byte-for-byte intact.
create or replace function club_private.advance_wallet_revision()
returns trigger language plpgsql security definer set search_path='' as $$ begin
  if row(new.ruby_balance,new.owned_items,new.equipped_char,new.equipped_bg,new.equipped_avatar,new.pending_notifications)
    is distinct from row(old.ruby_balance,old.owned_items,old.equipped_char,old.equipped_bg,old.equipped_avatar,old.pending_notifications) then
    insert into club_private.wallet_versions(user_id,revision) values(new.id,1)
    on conflict(user_id) do update set revision=club_private.wallet_versions.revision+1;
  end if;
  return new;
end $$;
revoke all on function club_private.advance_wallet_revision() from public,anon,authenticated;
create or replace trigger club_wallet_revision after update of ruby_balance,owned_items,equipped_char,equipped_bg,equipped_avatar,pending_notifications
on public.users for each row execute function club_private.advance_wallet_revision();

create or replace function club_private.wallet_json(p_user_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('user_id',u.id,'ruby_balance',u.ruby_balance,'owned_items',u.owned_items,
    'equipped_char',u.equipped_char,'equipped_bg',u.equipped_bg,'equipped_avatar',u.equipped_avatar,
    'revision',coalesce(v.revision,0),'pending_notifications',
      coalesce((select jsonb_agg(e.value order by e.ordinality)
        from jsonb_array_elements(u.pending_notifications) with ordinality e
        where not exists(select 1 from club_private.wallet_claims c where c.user_id=u.id and c.notification_id=e.value->>'id')),'[]'::jsonb),
    'catalog',(select jsonb_agg(jsonb_build_object('id',c.id,'type',c.item_type,'name',c.name,
      'price',c.price,'active',c.active,'revision',c.revision) order by c.id) from club_private.shop_catalog c))
  from public.users u left join club_private.wallet_versions v on v.user_id=u.id where u.id=p_user_id;
$$;
revoke all on function club_private.wallet_json(text) from public,anon,authenticated;

create or replace function public.club_wallet_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb := public.club_current_account(); begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  return club_private.wallet_json(v_actor->>'id');
end $$;
revoke all on function public.club_wallet_snapshot() from public,anon;
grant execute on function public.club_wallet_snapshot() to authenticated;

create or replace function club_private.shop_command(p_request_id uuid,p_item_id text,p_catalog_revision bigint,p_buy boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_user public.users%rowtype;
  v_item club_private.shop_catalog%rowtype;
  v_receipt club_private.wallet_requests%rowtype;
  v_payload jsonb;
  v_owned text[];
  v_free text;
  v_char text;
  v_bg text;
  v_avatar text;
  v_charged integer := 0;
  v_change boolean := false;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if p_request_id is null or p_item_id is null or btrim(p_item_id)='' or p_buy is null
    or (p_buy and (p_catalog_revision is null or p_catalog_revision<1)) then
    raise exception using errcode='22023',message='Invalid shop request';
  end if;
  v_payload := jsonb_build_object('item_id',p_item_id,'buy',p_buy,'catalog_revision',p_catalog_revision);
  -- Same user row lock as notification claims, preventing lost credit/debit and overspending.
  select * into strict v_user from public.users where id=v_actor->>'id' for update;
  select * into v_receipt from club_private.wallet_requests where user_id=v_user.id and request_id=p_request_id;
  if found then
    if v_receipt.payload<>v_payload then raise exception using errcode='22023',message='Request identifier already used'; end if;
    return jsonb_build_object('request_id',p_request_id,'wallet',club_private.wallet_json(v_user.id));
  end if;
  select * into v_item from club_private.shop_catalog where id=p_item_id for share;
  if not found then raise exception using errcode='22023',message='Unknown shop item'; end if;
  v_owned := v_user.owned_items;
  if p_buy then
    if not (p_item_id=any(v_owned)) then
      if not v_item.active then raise exception using errcode='22023',message='Item unavailable'; end if;
      if v_item.revision<>p_catalog_revision then raise exception using errcode='PT409',message='Catalog changed; refresh before buying'; end if;
      if v_user.ruby_balance<v_item.price then raise exception using errcode='PT402',message='Insufficient rubies'; end if;
      v_charged := v_item.price;
      -- Preserve all legacy inventory (including unknown IDs and reset markers).
      v_owned := array_append(v_owned,p_item_id);
      for v_free in select id from club_private.shop_catalog where price=0 and active order by id loop
        if not(v_free=any(v_owned)) then v_owned := array_append(v_owned,v_free); end if;
      end loop;
      v_change := true;
    end if;
  else
    if not(p_item_id=any(v_owned)) and v_item.price<>0 then
      raise exception using errcode='42501',message='Item not owned';
    end if;
    if not(p_item_id=any(v_owned)) then v_owned := array_append(v_owned,p_item_id); end if;
    v_change := (v_item.item_type='character' and v_user.equipped_char<>p_item_id)
      or (v_item.item_type='bg' and v_user.equipped_bg<>p_item_id) or v_owned<>v_user.owned_items;
  end if;
  if v_change then
    v_char := case when v_item.item_type='character' then p_item_id else v_user.equipped_char end;
    v_bg := case when v_item.item_type='bg' then p_item_id else v_user.equipped_bg end;
    select avatar_path into v_avatar from club_private.shop_catalog where id=v_char and item_type='character';
    v_avatar := coalesce(v_avatar,v_user.equipped_avatar[1],'/avatars/default_cat.png');
    update public.users set ruby_balance=ruby_balance-v_charged,owned_items=v_owned,
      equipped_char=v_char,equipped_bg=v_bg,equipped_avatar=array[v_avatar,v_char,v_bg] where id=v_user.id;
    insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,details)
    values(v_user.id,v_user.email,v_user.nickname,case when p_buy then 'Купил предмет' else 'Выбрал предмет' end,v_user.id,
      jsonb_build_object('item_id',p_item_id,'catalog_revision',v_item.revision,'charged',v_charged,
        'previous_balance',v_user.ruby_balance,'next_balance',v_user.ruby_balance-v_charged)::text);
  end if;
  insert into club_private.wallet_requests(user_id,request_id,item_id,payload,charged)
  values(v_user.id,p_request_id,p_item_id,v_payload,v_charged);
  return jsonb_build_object('request_id',p_request_id,'wallet',club_private.wallet_json(v_user.id));
end $$;
revoke all on function club_private.shop_command(uuid,text,bigint,boolean) from public,anon,authenticated;

create or replace function public.club_buy_item(p_request_id uuid,p_item_id text,p_catalog_revision bigint)
returns jsonb language sql security definer set search_path='' as $$
  select club_private.shop_command(p_request_id,p_item_id,p_catalog_revision,true);
$$;
create or replace function public.club_equip_item(p_request_id uuid,p_item_id text)
returns jsonb language sql security definer set search_path='' as $$
  select club_private.shop_command(p_request_id,p_item_id,null,false);
$$;
revoke all on function public.club_buy_item(uuid,text,bigint),public.club_equip_item(uuid,text) from public,anon;
grant execute on function public.club_buy_item(uuid,text,bigint),public.club_equip_item(uuid,text) to authenticated;

create or replace function public.club_claim_ruby_notification(p_notification_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_user public.users%rowtype;
  v_notification jsonb;
  v_index integer;
  v_count integer;
  v_amount numeric;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if p_notification_id is null or length(btrim(p_notification_id)) not between 1 and 500 then
    raise exception using errcode='22023',message='Invalid notification';
  end if;
  select * into strict v_user from public.users where id=v_actor->>'id' for update;
  if exists(select 1 from club_private.wallet_claims where user_id=v_user.id and notification_id=p_notification_id) then
    return jsonb_build_object('notification_id',p_notification_id,'wallet',club_private.wallet_json(v_user.id));
  end if;
  select count(*) into v_count from jsonb_array_elements(v_user.pending_notifications) e where e->>'id'=p_notification_id;
  if v_count<>1 then raise exception using errcode='22023',message='Unknown or ambiguous notification'; end if;
  select e.value,(e.ordinality-1)::integer into v_notification,v_index
  from jsonb_array_elements(v_user.pending_notifications) with ordinality e where e.value->>'id'=p_notification_id;
  if jsonb_typeof(v_notification->'amount') is distinct from 'number'
    or jsonb_typeof(v_notification->'message') is distinct from 'string' then
    raise exception using errcode='22023',message='Notification requires review';
  end if;
  v_amount := (v_notification->>'amount')::numeric;
  if v_amount<=0 or trunc(v_amount)<>v_amount or v_user.ruby_balance::numeric+v_amount>2147483647 then
    raise exception using errcode='22023',message='Invalid bonus amount';
  end if;
  insert into club_private.wallet_claims(user_id,notification_id,original_notification)
  values(v_user.id,p_notification_id,v_notification);
  update public.users set ruby_balance=ruby_balance+v_amount::integer,
    pending_notifications=pending_notifications-v_index where id=v_user.id;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,details)
  values(v_user.id,v_user.email,v_user.nickname,'Получил бонус',v_user.id,
    jsonb_build_object('notification_id',p_notification_id,'amount',v_amount,
      'previous_balance',v_user.ruby_balance,'next_balance',v_user.ruby_balance+v_amount)::text);
  return jsonb_build_object('notification_id',p_notification_id,'wallet',club_private.wallet_json(v_user.id));
end $$;
revoke all on function public.club_claim_ruby_notification(text) from public,anon;
grant execute on function public.club_claim_ruby_notification(text) to authenticated;
notify pgrst,'reload schema';
commit;
