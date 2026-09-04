-- Stage 2.3b: replace permissive authenticated policies with role/owner rules.
-- LOCAL ONLY until all direct protected writes are moved to server commands.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $$ begin
  if to_regprocedure('public.club_current_account()') is null then
    raise exception 'Auth foundation must be installed first';
  end if;
  if exists (
    select 1 from pg_policies where schemaname='public'
      and policyname not in ('users_all_access','tournaments_all_access','participants_all_access',
        'transactions_all_access','logs_all_access','timer_sessions_all_access',
        'users_read_authorized','users_update_authorized','tournaments_read_authorized','tournaments_admin_insert',
        'tournaments_admin_update','tournaments_admin_delete','participants_read_authorized',
        'participants_insert_authorized','participants_admin_update','participants_delete_authorized',
        'participants_admin_insert','participants_admin_delete',
        'transactions_read_authorized','logs_superadmin_read','logs_admin_insert',
        'timer_admin_read','timer_admin_insert','timer_admin_update','timer_authenticated_read')) then
    raise exception 'Unexpected public policy; review before cutover';
  end if;
end $$;

drop policy if exists users_all_access on public.users;
drop policy if exists tournaments_all_access on public.tournaments;
drop policy if exists participants_all_access on public.participants;
drop policy if exists transactions_all_access on public.transactions;
drop policy if exists logs_all_access on public.logs;
drop policy if exists timer_sessions_all_access on public.timer_sessions;

do $$ declare p record; begin
  for p in select tablename,policyname from pg_policies where schemaname='public' loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;

create policy users_read_authorized on public.users for select to authenticated using (
  id=(select public.club_current_account()->>'id')
  or (select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy users_update_authorized on public.users for update to authenticated using (
  id=(select public.club_current_account()->>'id')
  or (select public.club_current_account()->>'role') in ('admin','superadmin')) with check (
  id=(select public.club_current_account()->>'id')
  or (select public.club_current_account()->>'role') in ('admin','superadmin'));

create policy tournaments_read_authorized on public.tournaments for select to authenticated
  using ((select public.club_current_account()) is not null);
create policy tournaments_admin_insert on public.tournaments for insert to authenticated
  with check ((select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy tournaments_admin_update on public.tournaments for update to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'))
  with check ((select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy tournaments_admin_delete on public.tournaments for delete to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'));

create policy participants_read_authorized on public.participants for select to authenticated
  using ((select public.club_current_account()) is not null);
create policy participants_insert_authorized on public.participants for insert to authenticated with check (
  (select public.club_current_account()->>'role') in ('admin','superadmin') or (
    user_id=(select public.club_current_account()->>'id') and rating=0 and place is null
    and knockouts=0 and rubies_awarded is null and comment is null
    and exists(select 1 from public.tournaments t where t.id=tournament_id and not t.is_closed)));
create policy participants_admin_update on public.participants for update to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'))
  with check ((select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy participants_delete_authorized on public.participants for delete to authenticated using (
  (select public.club_current_account()->>'role') in ('admin','superadmin') or (
    user_id=(select public.club_current_account()->>'id')
    and exists(select 1 from public.tournaments t where t.id=tournament_id and not t.is_closed)));

create policy transactions_read_authorized on public.transactions for select to authenticated using (
  user_id=(select public.club_current_account()->>'id')
  or (select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy logs_superadmin_read on public.logs for select to authenticated
  using ((select public.club_current_account()->>'role')='superadmin');
create policy logs_admin_insert on public.logs for insert to authenticated with check (
  (select public.club_current_account()->>'role') in ('admin','superadmin')
  and admin_id=(select public.club_current_account()->>'id')
  and lower(admin_email)=lower((select public.club_current_account()->>'email')));
create policy timer_admin_read on public.timer_sessions for select to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy timer_admin_insert on public.timer_sessions for insert to authenticated
  with check ((select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy timer_admin_update on public.timer_sessions for update to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'))
  with check ((select public.club_current_account()->>'role') in ('admin','superadmin'));

revoke all on public.users,public.tournaments,public.participants,public.transactions,public.logs,public.timer_sessions
  from authenticated;
grant select,update on public.users to authenticated;
grant select,insert,update,delete on public.tournaments,public.participants to authenticated;
grant select on public.transactions to authenticated;
grant select,insert on public.logs to authenticated;
grant select,insert,update on public.timer_sessions to authenticated;

do $$ begin
  if exists(select 1 from pg_policies where schemaname='public'
    and (coalesce(qual,'') ~ '^\s*true\s*$' or coalesce(with_check,'') ~ '^\s*true\s*$')) then
    raise exception 'Permissive TRUE policy remains';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
