-- Add Karen to the shop catalogue. Rubies cannot buy him (buyable=false).
-- The achievement grant lives in 20260921_char_karen_reward.sql.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table club_private.shop_catalog
  add column if not exists buyable boolean not null default true;

insert into club_private.shop_catalog(id, item_type, name, price, avatar_path, active, buyable)
values ('char_karen', 'character', 'Карен', 0, '/avatars/karen.png', true, false)
on conflict (id) do update
  set name = excluded.name,
      price = excluded.price,
      avatar_path = excluded.avatar_path,
      active = excluded.active,
      buyable = excluded.buyable;

create or replace function club_private.wallet_json(p_user_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('user_id',u.id,'ruby_balance',u.ruby_balance,'owned_items',u.owned_items,
    'equipped_char',u.equipped_char,'equipped_bg',u.equipped_bg,'equipped_avatar',u.equipped_avatar,
    'revision',coalesce(v.revision,0),'pending_notifications',
      coalesce((select jsonb_agg(e.value order by e.ordinality)
        from jsonb_array_elements(u.pending_notifications) with ordinality e
        where not exists(select 1 from club_private.wallet_claims c where c.user_id=u.id and c.notification_id=e.value->>'id')),'[]'::jsonb),
    'catalog',(select jsonb_agg(jsonb_build_object('id',c.id,'type',c.item_type,'name',c.name,
      'price',c.price,'active',c.active,'revision',c.revision,'buyable',c.buyable) order by c.id) from club_private.shop_catalog c))
  from public.users u left join club_private.wallet_versions v on v.user_id=u.id where u.id=p_user_id;
$$;
revoke all on function club_private.wallet_json(text) from public,anon,authenticated;

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
      if not v_item.active or not v_item.buyable then
        raise exception using errcode='22023',message='Item unavailable';
      end if;
      if v_item.revision<>p_catalog_revision then raise exception using errcode='PT409',message='Catalog changed; refresh before buying'; end if;
      if v_user.ruby_balance<v_item.price then raise exception using errcode='PT402',message='Insufficient rubies'; end if;
      v_charged := v_item.price;
      v_owned := array_append(v_owned,p_item_id);
      for v_free in
        select id from club_private.shop_catalog
        where price=0 and active and buyable
        order by id
      loop
        if not(v_free=any(v_owned)) then v_owned := array_append(v_owned,v_free); end if;
      end loop;
      v_change := true;
    end if;
  else
    if not(p_item_id=any(v_owned)) and (v_item.price<>0 or not v_item.buyable) then
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

notify pgrst,'reload schema';
commit;
