-- First access cutover: no anonymous access to application objects in public.
-- LOCAL ONLY until coordinated deployment of the real Auth client/OTP handler.
-- Does not close authenticated legacy writes (the next cutover).
-- No application rows, roles, administrators or policies are changed here.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Refuse an incompatible identity setup rather than break login silently.
do $$
begin
  if to_regprocedure('public.club_open_session(boolean)') is null
    or to_regprocedure('public.club_current_account()') is null
    or to_regprocedure('public.verify_login_otp(text,text)') is null then
    raise exception 'Auth foundation and server OTP must be installed first';
  end if;
end;
$$;

revoke create on schema public from public, anon;
grant usage on schema public to authenticated, service_role;
revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
revoke all on all routines in schema public from public, anon;

-- A table REVOKE does not remove separately granted column privileges.
do $$
declare
  v_table record;
  v_owner record;
begin
  for v_table in
    select c.oid, c.relname, string_agg(quote_ident(a.attname), ',' order by a.attnum) as columns
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    where n.nspname='public' and c.relkind in ('r','p','v','m','f')
    group by c.oid,c.relname
  loop
    execute format('revoke all (%s) on table public.%I from public, anon', v_table.columns, v_table.relname);
  end loop;

  -- Cover current object creators plus roles with explicit public/global defaults.
  -- Missing authority to change any owner defaults aborts this entire transaction.
  for v_owner in
    select distinct r.rolname from pg_roles r where r.oid in (
      select relowner from pg_class where relnamespace='public'::regnamespace
      union select proowner from pg_proc where pronamespace='public'::regnamespace
      union select defaclrole from pg_default_acl where defaclnamespace in (0,'public'::regnamespace::oid)
      union select oid from pg_roles where rolname=current_user
    )
  loop
    -- Schema-level REVOKE cannot override a global default grant, including
    -- PostgreSQL's implicit PUBLIC EXECUTE on newly created functions.
    execute format('alter default privileges for role %I revoke all on tables from public, anon',v_owner.rolname);
    execute format('alter default privileges for role %I revoke all on sequences from public, anon',v_owner.rolname);
    execute format('alter default privileges for role %I revoke execute on functions from public, anon',v_owner.rolname);
    execute format('alter default privileges for role %I in schema public revoke all on tables from public, anon',v_owner.rolname);
    execute format('alter default privileges for role %I in schema public revoke all on sequences from public, anon',v_owner.rolname);
    execute format('alter default privileges for role %I in schema public revoke execute on functions from public, anon',v_owner.rolname);
  end loop;

  -- Effective privileges include inherited membership and object ownership.
  -- Do not silently revoke other roles/memberships to repair unexpected topology.
  if exists (
    select 1 from pg_class c where c.relnamespace='public'::regnamespace
      and case when c.relkind in ('r','p','v','m','f') then (
        has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) else false end
  ) or exists (
    select 1 from pg_class c where c.relnamespace='public'::regnamespace
      and case when c.relkind='S' then has_sequence_privilege('anon',c.oid,'USAGE,SELECT,UPDATE') else false end
  ) or exists (
    select 1 from pg_proc p where p.pronamespace='public'::regnamespace
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) or has_schema_privilege('anon','public','CREATE') then
    raise exception 'Unexpected inherited anonymous privileges; review role ownership/membership';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
