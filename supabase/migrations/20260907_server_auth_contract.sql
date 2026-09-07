-- Final server-authentication contract.
-- No application rows, balances, roles or administrator assignments are changed.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $$
declare
  v_required regprocedure[]:=array[
    'public.club_current_account()'::regprocedure,
    'public.club_open_session(boolean)'::regprocedure,
    'public.club_set_role(text,text)'::regprocedure,
    'public.club_directory()'::regprocedure,
    'public.club_create_charge(uuid,text,text,text,text)'::regprocedure,
    'public.club_mark_paid(text[])'::regprocedure,
    'public.club_void_transaction(text,text)'::regprocedure,
    'public.club_adjust_dealer_hours(uuid,text,text,numeric)'::regprocedure,
    'public.club_finance_snapshot()'::regprocedure,
    'public.club_personnel_snapshot()'::regprocedure,
    'public.club_personnel_command(uuid,text,text,uuid,jsonb)'::regprocedure,
    'public.club_wallet_snapshot()'::regprocedure,
    'public.club_buy_item(uuid,text,bigint)'::regprocedure,
    'public.club_equip_item(uuid,text)'::regprocedure,
    'public.club_claim_ruby_notification(text)'::regprocedure,
    'public.club_grant_rubies(uuid,text,integer,text,text)'::regprocedure,
    'public.club_close_tournament(uuid,text,jsonb)'::regprocedure,
    'public.club_update_profile(jsonb)'::regprocedure,
    'public.club_set_registration(uuid,text,boolean)'::regprocedure,
    'public.club_replace_participants(uuid,text,jsonb)'::regprocedure,
    'public.club_tournament_snapshot()'::regprocedure,
    'public.club_create_tournament(uuid,jsonb)'::regprocedure,
    'public.club_update_tournament(uuid,text,jsonb)'::regprocedure,
    'public.club_audit_snapshot()'::regprocedure,
    'public.club_save_timer_session(jsonb)'::regprocedure,
    'public.club_blind_structures_snapshot()'::regprocedure,
    'public.club_save_blind_structures(jsonb)'::regprocedure,
    'public.club_archive_profile(uuid,text,text)'::regprocedure
  ];
begin
  if exists(select 1 from pg_proc where oid=any(v_required) and not prosecdef) then
    raise exception 'Every client API routine must enforce its contract as SECURITY DEFINER';
  end if;
end;
$$;

-- A browser session may read only through the final RLS/projection rules and
-- may mutate state only through the explicit RPC allowlist below.
revoke insert,update,delete,truncate,references,trigger
  on all tables in schema public from authenticated;
revoke all on all tables in schema club_private from authenticated;
revoke all on all routines in schema public from authenticated;
revoke all on all routines in schema club_private from authenticated;
revoke usage on schema club_private from authenticated;

do $$
declare v_table record;
begin
  -- Table-level revokes do not remove old per-column grants.
  for v_table in
    select c.relname,string_agg(quote_ident(a.attname),',' order by a.attnum) columns
    from pg_class c
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v','m','f')
    group by c.oid,c.relname
  loop
    execute format('revoke insert(%s),update(%s),references(%s) on table public.%I from authenticated',
      v_table.columns,v_table.columns,v_table.columns,v_table.relname);
  end loop;
end;
$$;

grant execute on function
  public.club_current_account(),
  public.club_open_session(boolean),
  public.club_set_role(text,text),
  public.club_directory(),
  public.club_create_charge(uuid,text,text,text,text),
  public.club_mark_paid(text[]),
  public.club_void_transaction(text,text),
  public.club_adjust_dealer_hours(uuid,text,text,numeric),
  public.club_finance_snapshot(),
  public.club_personnel_snapshot(),
  public.club_personnel_command(uuid,text,text,uuid,jsonb),
  public.club_wallet_snapshot(),
  public.club_buy_item(uuid,text,bigint),
  public.club_equip_item(uuid,text),
  public.club_claim_ruby_notification(text),
  public.club_grant_rubies(uuid,text,integer,text,text),
  public.club_close_tournament(uuid,text,jsonb),
  public.club_update_profile(jsonb),
  public.club_set_registration(uuid,text,boolean),
  public.club_replace_participants(uuid,text,jsonb),
  public.club_tournament_snapshot(),
  public.club_create_tournament(uuid,jsonb),
  public.club_update_tournament(uuid,text,jsonb),
  public.club_audit_snapshot(),
  public.club_save_timer_session(jsonb),
  public.club_blind_structures_snapshot(),
  public.club_save_blind_structures(jsonb),
  public.club_archive_profile(uuid,text,text)
to authenticated;

do $$
declare v_owner record;
begin
  -- Future functions are private until their migration grants an explicit API.
  for v_owner in
    select distinct r.rolname from pg_roles r where r.oid in (
      select relowner from pg_class where relnamespace in ('public'::regnamespace,'club_private'::regnamespace)
      union select proowner from pg_proc where pronamespace in ('public'::regnamespace,'club_private'::regnamespace)
      union select oid from pg_roles where rolname=current_user
    )
  loop
    execute format('alter default privileges for role %I revoke execute on functions from authenticated',v_owner.rolname);
    execute format('alter default privileges for role %I in schema public revoke execute on functions from authenticated',v_owner.rolname);
    execute format('alter default privileges for role %I in schema club_private revoke execute on functions from authenticated',v_owner.rolname);
    execute format('alter default privileges for role %I revoke insert,update,delete,truncate,references,trigger on tables from authenticated',v_owner.rolname);
    execute format('alter default privileges for role %I in schema public revoke insert,update,delete,truncate,references,trigger on tables from authenticated',v_owner.rolname);
    execute format('alter default privileges for role %I in schema club_private revoke all on tables from authenticated',v_owner.rolname);
  end loop;
end;
$$;

do $$
begin
  if (select count(*) from pg_proc p where p.pronamespace='public'::regnamespace
      and has_function_privilege('authenticated',p.oid,'EXECUTE'))<>28 then
    raise exception 'Authenticated RPC allowlist differs from the expected contract';
  end if;
  if exists(
    select 1 from pg_class c
    where c.relnamespace in ('public'::regnamespace,'club_private'::regnamespace)
      and c.relkind in ('r','p','v','m','f')
      and (has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege('authenticated',c.oid,'INSERT,UPDATE,REFERENCES'))
  ) then raise exception 'Authenticated direct write privilege remains'; end if;
  if exists(
    select 1 from pg_class c where c.relnamespace='public'::regnamespace
      and c.relkind in ('r','p','v','m','f')
      and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
  ) or exists(
    select 1 from pg_proc p where p.pronamespace='public'::regnamespace
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) then raise exception 'Anonymous access remains'; end if;
  if has_schema_privilege('authenticated','club_private','USAGE') or exists(
    select 1 from pg_proc p where p.pronamespace='club_private'::regnamespace
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'Authenticated access to internal routines remains'; end if;
  if exists(select 1 from pg_policies where schemaname='public'
    and (coalesce(qual,'')~'^\s*true\s*$' or coalesce(with_check,'')~'^\s*true\s*$')) then
    raise exception 'Unconditional public policy remains';
  end if;
end;
$$;

notify pgrst,'reload schema';
commit;
