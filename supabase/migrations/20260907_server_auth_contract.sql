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

do $$
declare
  v_object record;
  v_authenticated oid:='authenticated'::regrole;
  v_current oid=current_user::regrole;
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
    'public.club_equip_item(uuid,text)',
    'public.club_claim_ruby_notification(text)',
    'public.club_grant_rubies(uuid,text,integer,text,text)',
    'public.club_close_tournament(uuid,text,jsonb)',
    'public.club_update_profile(jsonb)',
    'public.club_set_registration(uuid,text,boolean)',
    'public.club_replace_participants(uuid,text,jsonb)',
    'public.club_tournament_snapshot()',
    'public.club_create_tournament(uuid,jsonb)',
    'public.club_update_tournament(uuid,text,jsonb)',
    'public.club_audit_snapshot()',
    'public.club_save_timer_session(jsonb)',
    'public.club_blind_structures_snapshot()',
    'public.club_save_blind_structures(jsonb)',
    'public.club_archive_profile(uuid,text,text)'
  ]::regprocedure[];
begin
  -- Revoke only grants issued by the role applying this migration. Production
  -- API/private routines are owned by supabase_admin and must not be rewritten
  -- by the postgres migration role. Foreign grants are rejected by the final
  -- assertions instead of causing a partially applied ACL migration.
  for v_object in
    select distinct p.oid::regprocedure object_name
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where p.pronamespace='public'::regnamespace
      and acl.grantee=v_authenticated and acl.grantor=v_current
      and acl.privilege_type='EXECUTE'
      and p.oid<>all(v_required)
  loop
    execute format('revoke execute on function %s from authenticated',v_object.object_name);
  end loop;

  for v_object in
    select distinct c.oid::regclass object_name
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
    where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v','m','f')
      and acl.grantee=v_authenticated and acl.grantor=v_current
      and acl.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  loop
    execute format('revoke insert,update,delete,truncate,references,trigger on table %s from authenticated',v_object.object_name);
  end loop;

  for v_object in
    select distinct format('%I.%I',n.nspname,c.relname) table_name,
      string_agg(quote_ident(a.attname),',' order by a.attnum) columns
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    cross join lateral aclexplode(a.attacl) acl
    where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v','m','f')
      and acl.grantee=v_authenticated and acl.grantor=v_current
      and acl.privilege_type in ('INSERT','UPDATE','REFERENCES')
    group by c.oid,n.nspname,c.relname
  loop
    execute format('revoke insert(%s),update(%s),references(%s) on table %s from authenticated',
      v_object.columns,v_object.columns,v_object.columns,v_object.table_name);
  end loop;
end;
$$;

-- Objects created later by this migration role remain private until an explicit
-- API migration grants access. Other owners manage their own default ACLs.
alter default privileges revoke execute on functions from authenticated;
alter default privileges in schema public revoke execute on functions from authenticated;
alter default privileges revoke insert,update,delete,truncate,references,trigger on tables from authenticated;
alter default privileges in schema public revoke insert,update,delete,truncate,references,trigger on tables from authenticated;

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
