-- Optional. Run in the Supabase SQL editor only if log inserts still fail with
-- 23503 (foreign key) after deploying the client that omits *_id columns.
-- Does not delete existing rows.

alter table public.logs drop constraint if exists logs_admin_id_fkey;
alter table public.logs drop constraint if exists logs_target_user_id_fkey;
alter table public.logs drop constraint if exists logs_target_tournament_id_fkey;

drop policy if exists logs_all_access on public.logs;
create policy logs_all_access on public.logs
  for all
  using (true)
  with check (true);

grant all on table public.logs to anon, authenticated;
