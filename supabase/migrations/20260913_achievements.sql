-- Achievements become server state. Until now an administrator's grants were
-- written to the granting browser's localStorage, so players never saw them.
-- Applied after the server auth contract, therefore access is granted here.
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';

-- The new routines run as their owner, so that owner must be able to reuse the
-- existing session helper. Fail here instead of at runtime.
do $$
begin
  if not has_function_privilege(current_user,'public.club_current_account()','EXECUTE') then
    raise exception 'Apply this migration with a role that may call public.club_current_account()';
  end if;
end;
$$;

create table if not exists public.user_achievements(
  user_id text primary key references public.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text references public.users(id) on delete set null,
  constraint user_achievements_progress_object check(jsonb_typeof(progress)='object')
);
alter table public.user_achievements enable row level security;
revoke all on public.user_achievements from public,anon,authenticated;

-- Progress is a catalogue-keyed map: {"welcome":{"completed":true},"fish":{"progress":3}}.
create or replace function club_private.validate_achievements(p_progress jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_entry record; v_field text; v_progress numeric;
begin
  if p_progress is null or jsonb_typeof(p_progress)<>'object' then
    raise exception using errcode='22023',message='Invalid achievement payload';
  end if;
  if (select count(*) from jsonb_object_keys(p_progress))>200 then
    raise exception using errcode='22023',message='Too many achievements';
  end if;
  for v_entry in select key,value from jsonb_each(p_progress) loop
    if length(v_entry.key)<1 or length(v_entry.key)>64 or jsonb_typeof(v_entry.value)<>'object' then
      raise exception using errcode='22023',message='Invalid achievement entry';
    end if;
    for v_field in select k from jsonb_object_keys(v_entry.value) k loop
      if v_field not in ('progress','completed') then
        raise exception using errcode='22023',message='Unsupported achievement field';
      end if;
    end loop;
    if v_entry.value ? 'progress' then
      if jsonb_typeof(v_entry.value->'progress')<>'number' then
        raise exception using errcode='22023',message='Invalid achievement progress';
      end if;
      v_progress:=(v_entry.value->>'progress')::numeric;
      if v_progress<0 or v_progress>1000000 or v_progress<>trunc(v_progress) then
        raise exception using errcode='22023',message='Invalid achievement progress';
      end if;
    end if;
    if v_entry.value ? 'completed' and jsonb_typeof(v_entry.value->'completed')<>'boolean' then
      raise exception using errcode='22023',message='Invalid achievement flag';
    end if;
  end loop;
  return p_progress;
end $$;

-- Trophies are visible to the whole club: a player opens another profile and
-- sees the same badges the owner sees.
create or replace function public.club_achievements_snapshot(p_user_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_progress jsonb;
begin
  if public.club_current_account() is null then
    raise exception using errcode='42501',message='Club member required';
  end if;
  select progress into v_progress from public.user_achievements where user_id=p_user_id;
  return coalesce(v_progress,'{}'::jsonb);
end $$;

create or replace function public.club_save_achievements(p_user_id text,p_progress jsonb)
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
  -- The command replaces the whole grant list, so a replay changes nothing and
  -- needs no request identifier. Only a real change is audited.
  insert into public.user_achievements(user_id,progress,updated_at,updated_by)
  values(v_user.id,v_progress,now(),v_actor->>'id')
  on conflict(user_id) do update set progress=excluded.progress,
    updated_at=excluded.updated_at,updated_by=excluded.updated_by;
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

revoke all on function club_private.validate_achievements(jsonb) from public,anon,authenticated;
revoke all on function public.club_achievements_snapshot(text) from public,anon;
revoke all on function public.club_save_achievements(text,jsonb) from public,anon;
grant execute on function public.club_achievements_snapshot(text),
  public.club_save_achievements(text,jsonb) to authenticated;

do $$
begin
  if not has_function_privilege('authenticated','public.club_achievements_snapshot(text)','EXECUTE')
    or not has_function_privilege('authenticated','public.club_save_achievements(text,jsonb)','EXECUTE') then
    raise exception 'Achievement API is not reachable by club members';
  end if;
  if has_table_privilege('authenticated','public.user_achievements','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('anon','public.club_achievements_snapshot(text)','EXECUTE')
    or has_function_privilege('anon','public.club_save_achievements(text,jsonb)','EXECUTE') then
    raise exception 'Achievement storage is directly reachable';
  end if;
end;
$$;

notify pgrst,'reload schema';
commit;
