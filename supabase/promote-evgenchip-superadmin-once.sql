-- One-off: promote Evgenchip to superadmin so the Users (incl. birthdays)
-- and Logs screens, which are SuperAdmin-only, become available.
-- Apply once as supabase_admin. Not a numbered migration.
-- Idempotent via public.logs (script id in details).
-- club_set_role cannot assign superadmin; this writes profile_roles directly.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

do $$
declare
  v_script constant text := 'promote-evgenchip-superadmin-once';
  v_user_id constant text := 'd50196b1-08fe-46f1-a9ce-6d92e0415f86';
  v_user public.users%rowtype;
  v_role text;
begin
  if exists (
    select 1 from public.logs
    where action_type = 'Изменение роли'
      and target_user_id = v_user_id
      and details like '%' || v_script || '%'
  ) then
    raise notice 'Already applied % — nothing changed', v_script;
    return;
  end if;

  select * into v_user from public.users where id = v_user_id for update;
  if not found or lower(btrim(v_user.nickname)) <> 'evgenchip' then
    raise exception using
      errcode = '22023',
      message = 'Evgenchip account not found or nickname mismatch';
  end if;

  select role into v_role
  from club_private.profile_roles
  where user_id = v_user.id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Evgenchip has no profile role';
  end if;

  if v_role = 'superadmin' then
    raise notice 'Evgenchip is already superadmin — nothing changed';
    return;
  end if;

  if v_role is distinct from 'admin' then
    raise exception using
      errcode = '22023',
      message = format('Evgenchip role is %, expected admin', v_role);
  end if;

  update club_private.profile_roles
  set role = 'superadmin'
  where user_id = v_user.id;

  update public.users
  set is_admin = true
  where id = v_user.id;

  insert into public.logs (
    admin_id, admin_email, admin_name, action_type,
    target_user_id, target_user_email, target_user_name, details
  ) values (
    null, 'script@local', 'role-grant', 'Изменение роли',
    v_user.id, v_user.email, v_user.nickname,
    jsonb_build_object(
      'script', v_script,
      'previous_role', v_role,
      'next_role', 'superadmin'
    )::text
  );

  raise notice 'Promoted Evgenchip from % to superadmin', v_role;
end $$;

commit;
