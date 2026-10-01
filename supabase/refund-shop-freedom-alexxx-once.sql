-- One-off: cancel shop purchases for nicknames Freedom and AleXXX and refund
-- rubies still owed (sum of charged receipts minus prior shop-refund logs).
--
-- Apply once in the Supabase SQL editor. Not a numbered migration.
-- Idempotent per user via public.logs (script id in details).
-- Does not delete wallet_requests receipts.
-- Nickname match is exact after trim: Freedom, AleXXX (case-sensitive).
-- If several accounts share a nickname, every match is refunded.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

do $$
declare
  v_script constant text := 'refund-shop-freedom-alexxx-once';
  v_keep constant text[] := array['cosmetics-reset-v2', 'char_base', 'bg_base'];
  v_user public.users%rowtype;
  v_charged integer;
  v_already integer;
  v_refund integer;
  v_owned text[];
  v_done integer := 0;
  v_matched integer;
begin
  select count(*) into v_matched
  from public.users
  where btrim(nickname) in ('Freedom', 'AleXXX');

  if v_matched = 0 then
    raise notice 'No users named Freedom or AleXXX — nothing refunded, run again after checking nicknames';
    return;
  end if;

  raise notice 'Matched % account(s) named Freedom or AleXXX', v_matched;

  for v_user in
    select * from public.users
    where btrim(nickname) in ('Freedom', 'AleXXX')
    order by id
    for update
  loop
    if exists (
      select 1 from public.logs
      where action_type = 'Возврат покупок магазина'
        and target_user_id = v_user.id
        and details like '%' || v_script || '%'
    ) then
      raise notice 'Already refunded % (%)', v_user.nickname, v_user.id;
      continue;
    end if;

    select coalesce(sum(charged), 0)::integer into v_charged
    from club_private.wallet_requests
    where user_id = v_user.id and charged > 0;

    select coalesce(sum((details::jsonb->>'refunded')::integer), 0) into v_already
    from public.logs
    where action_type = 'Возврат покупок магазина'
      and target_user_id = v_user.id
      and details ~ '^\s*\{'
      and jsonb_typeof(details::jsonb->'refunded') = 'number';

    v_refund := greatest(v_charged - v_already, 0);

    select coalesce(array_agg(x order by x), v_keep) into v_owned
    from (
      select distinct x
      from unnest(coalesce(v_user.owned_items, '{}'::text[])) as x
      where x = any (v_keep)
         or not exists (
           select 1 from club_private.shop_catalog c
           where c.id = x and c.price > 0
         )
      union
      select unnest(v_keep)
    ) kept(x);

    if v_user.ruby_balance > 2147483647 - v_refund then
      raise exception using
        errcode = '22003',
        message = format('Ruby overflow for %s', v_user.id);
    end if;

    update public.users
    set
      ruby_balance = ruby_balance + v_refund,
      owned_items = v_owned,
      equipped_char = 'char_base',
      equipped_bg = 'bg_base',
      equipped_avatar = array['/avatars/default_cat.png', 'char_base', 'bg_base']::text[]
    where id = v_user.id;

    insert into public.logs (
      admin_id, admin_email, admin_name, action_type,
      target_user_id, target_user_email, target_user_name, details
    ) values (
      null, 'script@local', 'shop-refund', 'Возврат покупок магазина',
      v_user.id, v_user.email, v_user.nickname,
      jsonb_build_object(
        'script', v_script,
        'refunded', v_refund,
        'charged_total', v_charged,
        'already_refunded', v_already,
        'nickname', v_user.nickname
      )::text
    );

    v_done := v_done + 1;
    raise notice 'Refunded % (%) +% rubies (charged %, already %)',
      v_user.nickname, v_user.id, v_refund, v_charged, v_already;
  end loop;

  raise notice 'Refunded % account(s)', v_done;
end $$;

commit;
