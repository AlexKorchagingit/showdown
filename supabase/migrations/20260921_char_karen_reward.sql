-- Completing "Выбить Карена" grants char_karen; clearing the badge takes it back.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Grant or revoke char_karen from a locked users row. Called from club_save_achievements.
create or replace function club_private.sync_knock_karen_reward(p_user_id text, p_progress jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_done boolean := coalesce(p_progress->'knock-karen'->>'completed','') = 'true';
  v_user public.users%rowtype;
  v_owned text[];
  v_char text;
  v_bg text;
  v_avatar text;
begin
  select * into v_user from public.users where id=p_user_id;
  if not found then return; end if;
  v_owned := coalesce(v_user.owned_items, '{}'::text[]);

  if v_done then
    if not ('char_karen' = any (v_owned)) then
      v_owned := array_append(v_owned, 'char_karen');
      update public.users set owned_items = v_owned where id = v_user.id;
    end if;
    return;
  end if;

  if not ('char_karen' = any (v_owned)) then
    return;
  end if;

  v_owned := array_remove(v_owned, 'char_karen');
  v_char := case when v_user.equipped_char = 'char_karen' then 'char_base' else v_user.equipped_char end;
  v_bg := v_user.equipped_bg;
  if v_char = 'char_base' then
    select avatar_path into v_avatar from club_private.shop_catalog
      where id = 'char_base' and item_type = 'character';
    v_avatar := coalesce(v_avatar, '/avatars/default_cat.png');
  else
    v_avatar := coalesce(v_user.equipped_avatar[1], '/avatars/default_cat.png');
  end if;
  update public.users
  set owned_items = v_owned,
      equipped_char = v_char,
      equipped_avatar = array[v_avatar, v_char, v_bg]
  where id = v_user.id;
end $$;
revoke all on function club_private.sync_knock_karen_reward(text, jsonb) from public,anon,authenticated;

create or replace function public.club_save_achievements(p_user_id text, p_progress jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account(); v_role text;
  v_user public.users%rowtype; v_previous jsonb; v_progress jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then
    raise exception using errcode='42501',message='Administrator required';
  end if;
  if p_user_id is null or btrim(p_user_id)='' then
    raise exception using errcode='22023',message='Unknown target account';
  end if;
  v_progress:=club_private.validate_achievements(p_progress);
  select * into v_user from public.users where id=p_user_id for update;
  if not found then raise exception using errcode='22023',message='Unknown target account'; end if;
  select progress into v_previous from public.user_achievements where user_id=v_user.id for update;
  insert into public.user_achievements(user_id,progress,updated_at,updated_by)
  values(v_user.id,v_progress,now(),v_actor->>'id')
  on conflict(user_id) do update set progress=excluded.progress,
    updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  perform club_private.sync_knock_karen_reward(v_user.id, v_progress);
  if coalesce(v_previous,'{}'::jsonb)<>v_progress then
    insert into public.logs(admin_id,admin_email,admin_name,action_type,
      target_user_id,target_user_email,target_user_name,details)
    values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Изменил достижения',
      v_user.id,v_user.email,v_user.nickname,
      jsonb_build_object('granted',(select count(*) from jsonb_each(v_progress) e
        where e.value->>'completed'='true' or coalesce((e.value->>'progress')::numeric,0)>0))::text);
  end if;
  return jsonb_build_object('user_id',v_user.id,'progress',v_progress);
end $$;
revoke all on function public.club_save_achievements(text,jsonb) from public,anon;
grant execute on function public.club_save_achievements(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
