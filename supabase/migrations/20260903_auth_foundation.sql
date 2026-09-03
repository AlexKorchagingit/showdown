-- Stage 2.1: additive identity/role foundation, NOT the access cutover.
-- Apply only in the isolated test environment until production approval.
-- Does not revoke legacy table access yet: protected business RPCs must land first.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create schema if not exists club_private;
revoke all on schema club_private from public, anon, authenticated;
alter default privileges in schema club_private revoke execute on functions from public;
alter default privileges in schema club_private revoke all on tables from public, anon, authenticated;

create table if not exists club_private.profile_roles (
  user_id text primary key references public.users(id) on delete restrict,
  role text not null check (role in ('user', 'admin', 'superadmin'))
);
create table if not exists club_private.auth_links (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  user_id text not null unique references public.users(id) on delete restrict,
  linked_at timestamptz not null default now()
);
alter table club_private.profile_roles enable row level security;
alter table club_private.auth_links enable row level security;
revoke all on club_private.profile_roles, club_private.auth_links from public, anon, authenticated;

-- Preserve all existing flags; never guess or automatically assign SuperAdmin.
-- ON CONFLICT ensures rerunning this migration cannot demote an existing role.
insert into club_private.profile_roles(user_id, role)
select id, case when is_admin then 'admin' else 'user' end from public.users
on conflict (user_id) do nothing;

create or replace function public.club_current_account()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(u) || jsonb_build_object('role', r.role,
    'is_admin', r.role in ('admin', 'superadmin'))
  from club_private.auth_links l
  join club_private.profile_roles r on r.user_id = l.user_id
  join public.users u on u.id = l.user_id
  join auth.users a on a.id = l.auth_user_id
  where l.auth_user_id = auth.uid()
    and a.email_confirmed_at is not null
    and not coalesce(a.is_anonymous, false)
    and (a.banned_until is null or a.banned_until <= now());
$$;

create or replace function public.club_open_session(p_accept_agreements boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_auth_id uuid := auth.uid();
  v_email text;
  v_user public.users%rowtype;
  v_role text;
  v_matches integer;
  v_new boolean := false;
  v_existing jsonb;
begin
  if v_auth_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select lower(btrim(a.email)) into v_email from auth.users a
  where a.id = v_auth_id and a.email_confirmed_at is not null
    and not coalesce(a.is_anonymous, false)
    and (a.banned_until is null or a.banned_until <= now());
  if v_email is null or v_email = '' then
    raise exception using errcode = '42501', message = 'Verified account required';
  end if;

  -- Serialise both simultaneous first logins and email-change/link races.
  perform pg_advisory_xact_lock(hashtextextended('showdown-auth:' || v_auth_id::text, 0));
  v_existing := public.club_current_account();
  if v_existing is not null then
    return jsonb_build_object('status', 'ready', 'is_new', false, 'user', v_existing);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('showdown-email:' || v_email, 0));
  select count(*) into v_matches from public.users where lower(btrim(email)) = v_email;
  if v_matches > 1 then
    raise exception using errcode = '22023', message = 'Ambiguous profile; administrator review required';
  end if;
  select * into v_user from public.users where lower(btrim(email)) = v_email for update;
  if found then
    if exists (select 1 from club_private.auth_links where user_id = v_user.id) then
      raise exception using errcode = '42501', message = 'Profile already linked';
    end if;
  else
    if p_accept_agreements is distinct from true then
      return jsonb_build_object('status', 'consent_required');
    end if;
    insert into public.users(email, nickname, agreements_accepted_at, is_admin)
    values (v_email, 'Игрок ' || substr(gen_random_uuid()::text, 1, 6), now(), false)
    returning * into v_user;
    v_new := true;
  end if;
  -- A new/unseeded profile is never promoted based on a client-controlled flag.
  insert into club_private.profile_roles(user_id, role) values (v_user.id, 'user')
  on conflict (user_id) do nothing;
  insert into club_private.auth_links(auth_user_id, user_id) values (v_auth_id, v_user.id);
  select role into v_role from club_private.profile_roles where user_id = v_user.id;
  if v_new then
    insert into public.logs(admin_id, admin_email, admin_name, action_type,
      target_user_id, details)
    values (v_user.id, v_user.email, v_user.nickname, 'Согласия приняты (электронная подпись)',
      v_user.id, 'Регистрация: согласия подтверждены после проверки почты');
  end if;
  return jsonb_build_object('status', 'ready', 'is_new', v_new, 'user',
    to_jsonb(v_user) || jsonb_build_object('role', v_role, 'is_admin', v_role in ('admin','superadmin')));
end;
$$;

create or replace function public.club_set_role(p_user_id text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_previous text;
  v_user public.users%rowtype;
begin
  if v_actor is null or v_actor->>'role' is distinct from 'superadmin' then
    raise exception using errcode = '42501', message = 'SuperAdmin required';
  end if;
  -- Initial SuperAdmin assignment/transfer is a separate approved admin operation.
  if p_role is null or p_role not in ('user','admin') then
    raise exception using errcode = '22023', message = 'Unsupported role';
  end if;
  select role into v_previous from club_private.profile_roles where user_id = p_user_id for update;
  if not found or v_previous = 'superadmin' then
    raise exception using errcode = '42501', message = 'Protected or unknown account';
  end if;
  if v_previous <> p_role then
    update club_private.profile_roles set role = p_role where user_id = p_user_id;
    update public.users set is_admin = (p_role = 'admin') where id = p_user_id;
    insert into public.logs(admin_id, admin_email, admin_name, action_type, target_user_id, details)
    values (v_actor->>'id', v_actor->>'email', v_actor->>'nickname', 'Изменение роли', p_user_id,
      jsonb_build_object('previous_role', v_previous, 'next_role', p_role)::text);
  end if;
  select * into v_user from public.users where id = p_user_id;
  return to_jsonb(v_user) || jsonb_build_object('role', p_role, 'is_admin', p_role = 'admin');
end;
$$;

create or replace function public.club_directory()
returns setof jsonb language sql stable security definer set search_path = '' as $$
  with actor as (select public.club_current_account() as account)
  select (case when actor.account->>'role' in ('admin','superadmin') or actor.account->>'id' = u.id
    then to_jsonb(u)
    else jsonb_build_object('id',u.id,'email','','nickname',u.nickname,'slogan',u.slogan,
      'equipped_char',u.equipped_char,'equipped_bg',u.equipped_bg,'equipped_avatar',u.equipped_avatar,
      'ruby_balance',0,'owned_items','[]'::jsonb,'pending_notifications','[]'::jsonb,'birth_date','')
    end) || jsonb_build_object('role',r.role,'is_admin',r.role in ('admin','superadmin'))
  from public.users u join club_private.profile_roles r on r.user_id=u.id cross join actor
  where actor.account is not null order by u.nickname, u.id;
$$;

revoke all on function public.club_directory() from public, anon;
grant execute on function public.club_directory() to authenticated;
revoke all on function public.club_current_account() from public, anon;
revoke all on function public.club_open_session(boolean) from public, anon;
revoke all on function public.club_set_role(text,text) from public, anon;
grant execute on function public.club_current_account(), public.club_open_session(boolean),
  public.club_set_role(text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
