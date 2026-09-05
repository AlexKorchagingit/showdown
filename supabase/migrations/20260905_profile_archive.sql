-- Safe profile archival. No user, role, Auth link, finance or history row is deleted.
-- Apply only after the auth foundation and final access cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.archived_profiles (
  user_id text primary key references public.users(id) on delete restrict,
  archived_by text not null references public.users(id) on delete restrict,
  archived_at timestamptz not null default now(),
  reason text not null check (char_length(reason) between 3 and 1000)
);
create table if not exists club_private.profile_archive_requests (
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  user_id text not null references public.users(id) on delete restrict,
  reason text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
alter table club_private.archived_profiles enable row level security;
alter table club_private.profile_archive_requests enable row level security;
revoke all on club_private.archived_profiles,club_private.profile_archive_requests
  from public,anon,authenticated;

create or replace function public.club_current_account()
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(u) || jsonb_build_object('role',r.role,
    'is_admin',r.role in ('admin','superadmin'))
  from club_private.auth_links l
  join club_private.profile_roles r on r.user_id=l.user_id
  join public.users u on u.id=l.user_id
  join auth.users a on a.id=l.auth_user_id
  where l.auth_user_id=auth.uid()
    and a.email_confirmed_at is not null
    and not coalesce(a.is_anonymous,false)
    and (a.banned_until is null or a.banned_until<=now())
    and not exists(select 1 from club_private.archived_profiles x where x.user_id=l.user_id);
$$;

create or replace function public.club_directory()
returns setof jsonb language sql stable security definer set search_path='' as $$
  with actor as (select public.club_current_account() as account)
  select (case when actor.account->>'role' in ('admin','superadmin') or actor.account->>'id'=u.id
    then to_jsonb(u)
    else jsonb_build_object('id',u.id,'email','','nickname',u.nickname,'slogan',u.slogan,
      'equipped_char',u.equipped_char,'equipped_bg',u.equipped_bg,'equipped_avatar',u.equipped_avatar,
      'ruby_balance',0,'owned_items','[]'::jsonb,'pending_notifications','[]'::jsonb,'birth_date','')
    end) || jsonb_build_object('role',r.role,'is_admin',r.role in ('admin','superadmin'))
  from public.users u
  join club_private.profile_roles r on r.user_id=u.id
  cross join actor
  where actor.account is not null
    and not exists(select 1 from club_private.archived_profiles x where x.user_id=u.id)
  order by u.nickname,u.id;
$$;

create or replace function public.club_archive_profile(
  p_request_id uuid,p_user_id text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb:=public.club_current_account();
  v_user public.users%rowtype;
  v_role text;
  v_reason text:=btrim(coalesce(p_reason,''));
  v_saved club_private.profile_archive_requests%rowtype;
  v_existing club_private.archived_profiles%rowtype;
  v_result jsonb;
begin
  if v_actor is null or v_actor->>'role' is distinct from 'superadmin' then
    raise exception using errcode='42501',message='SuperAdmin required';
  end if;
  if p_request_id is null or p_user_id is null or btrim(p_user_id)=''
    or char_length(v_reason) not between 3 and 1000 then
    raise exception using errcode='22023',message='Invalid archive request';
  end if;
  if p_user_id=v_actor->>'id' then
    raise exception using errcode='42501',message='Cannot archive current account';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'showdown-profile-archive:'||(v_actor->>'id')||':'||p_request_id::text,0));
  select * into v_saved from club_private.profile_archive_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_saved.user_id is distinct from p_user_id or v_saved.reason is distinct from v_reason then
      raise exception using errcode='22023',message='Request identity reused with different parameters';
    end if;
    return v_saved.result;
  end if;

  select * into v_user from public.users where id=p_user_id for update;
  if not found then
    raise exception using errcode='22023',message='Unknown account';
  end if;
  select role into v_role from club_private.profile_roles where user_id=p_user_id for update;
  if not found then
    raise exception using errcode='22023',message='Unknown account role';
  end if;
  if v_role='superadmin' then
    raise exception using errcode='42501',message='SuperAdmin account is protected';
  end if;

  select * into v_existing from club_private.archived_profiles where user_id=p_user_id;
  if found then
    v_result:=jsonb_build_object('request_id',p_request_id,'user_id',p_user_id,
      'archived',true,'already_archived',true,'archived_at',v_existing.archived_at);
  else
    insert into club_private.archived_profiles(user_id,archived_by,reason)
      values(p_user_id,v_actor->>'id',v_reason) returning * into v_existing;
    v_result:=jsonb_build_object('request_id',p_request_id,'user_id',p_user_id,
      'archived',true,'already_archived',false,'archived_at',v_existing.archived_at);
    insert into public.logs(admin_id,admin_email,admin_name,action_type,
      target_user_id,target_user_email,target_user_name,details)
    values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Архивация профиля',
      v_user.id,v_user.email,v_user.nickname,v_reason);
  end if;
  insert into club_private.profile_archive_requests(actor_id,request_id,user_id,reason,result)
    values(v_actor->>'id',p_request_id,p_user_id,v_reason,v_result);
  return v_result;
end;
$$;

revoke all on function public.club_archive_profile(uuid,text,text) from public,anon;
grant execute on function public.club_archive_profile(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
