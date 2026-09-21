-- One-off: take char_king (Король) from nickname BoneF1re.
-- Does not refund rubies. If the skin is equipped, switch to the base character.
-- Apply once as supabase_admin. Not a numbered migration.
-- Idempotent via public.logs (script id in details).

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

do $$
declare
  v_script constant text := 'revoke-char-king-bonef1re-once';
  v_user_id constant text := '69a3547a-368a-41f8-952f-0885f60ae704';
  v_user public.users%rowtype;
  v_owned text[];
  v_char text;
  v_bg text;
  v_avatar text;
  v_had boolean;
  v_equipped boolean;
begin
  if exists (
    select 1 from public.logs
    where action_type = 'Забрал предмет'
      and target_user_id = v_user_id
      and details like '%' || v_script || '%'
  ) then
    raise notice 'Already applied % — nothing changed', v_script;
    return;
  end if;

  select * into v_user from public.users where id = v_user_id for update;
  if not found or lower(btrim(v_user.nickname)) <> 'bonef1re' then
    raise exception using
      errcode = '22023',
      message = 'BoneF1re account not found or nickname mismatch';
  end if;

  v_had := 'char_king' = any (coalesce(v_user.owned_items, '{}'::text[]));
  v_equipped := v_user.equipped_char = 'char_king'
    or coalesce(v_user.equipped_avatar[2], '') = 'char_king';

  if not v_had and not v_equipped then
    raise exception using
      errcode = '22023',
      message = 'BoneF1re does not own or wear Король';
  end if;

  select coalesce(array_agg(x order by x), '{}'::text[]) into v_owned
  from unnest(coalesce(v_user.owned_items, '{}'::text[])) as x
  where x is distinct from 'char_king';

  v_char := case when v_user.equipped_char = 'char_king' then 'char_base' else v_user.equipped_char end;
  v_bg := coalesce(nullif(v_user.equipped_bg, ''), 'bg_base');
  select avatar_path into v_avatar
  from club_private.shop_catalog
  where id = v_char and item_type = 'character';
  v_avatar := coalesce(v_avatar, '/avatars/default_cat.png');

  update public.users
  set
    owned_items = v_owned,
    equipped_char = v_char,
    equipped_bg = v_bg,
    equipped_avatar = array[v_avatar, v_char, v_bg]::text[]
  where id = v_user.id;

  insert into public.logs (
    admin_id, admin_email, admin_name, action_type,
    target_user_id, target_user_email, target_user_name, details
  ) values (
    null, 'script@local', 'shop-revoke', 'Забрал предмет',
    v_user.id, v_user.email, v_user.nickname,
    jsonb_build_object(
      'script', v_script,
      'item_id', 'char_king',
      'had_item', v_had,
      'was_equipped', v_equipped,
      'equipped_char_to', v_char
    )::text
  );

  raise notice 'Revoked Король from % (equipped % -> %)', v_user.nickname, v_equipped, v_char;
end $$;

commit;
