-- Stage 2.3g: remove every direct client UPDATE path to public.users.
-- Protected server commands continue to work as SECURITY DEFINER functions.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $$ begin
  if to_regprocedure('public.club_update_profile(jsonb)') is null
    or to_regprocedure('public.club_wallet_snapshot()') is null
    or to_regprocedure('public.club_grant_rubies(uuid,text,integer,text,text)') is null then
    raise exception 'Protected user commands must be installed before revoking UPDATE';
  end if;
end $$;

drop policy if exists users_update_authorized on public.users;
revoke update on table public.users from public,anon,authenticated;

do $$ begin
  if has_table_privilege('anon','public.users','UPDATE')
    or has_table_privilege('authenticated','public.users','UPDATE')
    or exists(select 1 from information_schema.column_privileges
      where table_schema='public' and table_name='users'
        and grantee in ('PUBLIC','anon','authenticated') and privilege_type='UPDATE')
    or exists(select 1 from pg_policies where schemaname='public' and tablename='users'
      and cmd in ('ALL','UPDATE')) then
    raise exception 'A direct public.users UPDATE path remains';
  end if;
end $$;

notify pgrst,'reload schema';
commit;
