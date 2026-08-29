-- Live blinds timer snapshot shared by every admin device and browser tab.
-- Safe to re-run. The app also falls back to a hidden logs row if this table
-- is not present yet.

create table if not exists public.timer_sessions (
  id text primary key default 'live',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.timer_sessions (id, payload)
values ('live', '{}'::jsonb)
on conflict (id) do nothing;

drop trigger if exists timer_sessions_set_updated_at on public.timer_sessions;
create trigger timer_sessions_set_updated_at
  before update on public.timer_sessions
  for each row execute procedure public.set_updated_at();

alter table public.timer_sessions enable row level security;
drop policy if exists timer_sessions_all_access on public.timer_sessions;
create policy timer_sessions_all_access on public.timer_sessions
  for all using (true) with check (true);

grant all on table public.timer_sessions to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.timer_sessions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
