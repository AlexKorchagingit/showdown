-- Showdown club schema, mapped from the current TypeScript models:
--   User / UserData / MockUser  -> public.users
--   Tournament                  -> public.tournaments
--   Participant                 -> public.participants
--   Transaction                 -> public.transactions
--   ActionLog                   -> public.logs
--
-- Ids stay as text so they can match the existing client ids
-- ('1', 'opening', 'me', …) when we swap localStorage for Postgres.
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  email text not null unique,
  nickname text not null,
  is_admin boolean not null default false,
  ruby_balance integer not null default 1500,
  agreements_accepted_at timestamptz,
  birth_date text not null default '',
  slogan text not null default '',
  owned_items text[] not null default array['cosmetics-reset-v2', 'char_base', 'bg_base']::text[],
  equipped_char text not null default 'char_base',
  equipped_bg text not null default 'bg_base',
  -- Shop assets currently worn (character / background ids or URLs).
  equipped_avatar text[] not null default '{}'::text[],
  pending_notifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_ruby_balance_nonnegative check (ruby_balance >= 0)
);

create index if not exists users_email_idx on public.users (email);

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  image_url text not null default '',
  address text not null default '',
  start_date date not null,
  start_time text not null default '19:00',
  total_seats integer not null default 27,
  guarantee integer not null default 0,
  about text not null default '',
  features text[] not null default '{}'::text[],
  late_reg_until text not null default '',
  blind_structure text not null default '',
  blind_structure_id text,
  stack_size integer not null default 30000,
  level_duration text not null default '20 мин',
  is_closed boolean not null default false,
  is_bounty boolean not null default false,
  results_entered boolean not null default false,
  rubies_distributed boolean not null default false,
  admin_secret_comment text,
  staff jsonb not null default '[]'::jsonb,
  dealers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_total_seats_positive check (total_seats > 0),
  constraint tournaments_guarantee_nonnegative check (guarantee >= 0)
);

create index if not exists tournaments_start_date_idx on public.tournaments (start_date, start_time);
create index if not exists tournaments_is_closed_idx on public.tournaments (is_closed);

-- ---------------------------------------------------------------------------
-- participants  (one seated player in one event)
-- ---------------------------------------------------------------------------
create table if not exists public.participants (
  id text primary key default gen_random_uuid()::text,
  tournament_id text not null references public.tournaments (id) on delete cascade,
  user_id text references public.users (id) on delete set null,
  nickname text not null,
  rating integer not null default 0,
  place integer,
  knockouts integer not null default 0,
  rubies_awarded integer,
  comment text,
  arrived boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_place_positive check (place is null or place >= 1),
  constraint participants_knockouts_nonnegative check (knockouts >= 0)
);

create index if not exists participants_tournament_id_idx on public.participants (tournament_id);
create index if not exists participants_user_id_idx on public.participants (user_id);
create unique index if not exists participants_tournament_user_uidx
  on public.participants (tournament_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- transactions  (cashier ledger)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id text primary key default gen_random_uuid()::text,
  date timestamptz not null default now(),
  tournament_id text not null references public.tournaments (id) on delete cascade,
  user_id text not null references public.users (id) on delete restrict,
  type text not null,
  amount integer not null default 0,
  status text not null default 'unpaid',
  comment text not null default '',
  is_dealer boolean not null default false,
  dealer_hours numeric(6, 1) not null default 0,
  updated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint transactions_type_check check (type in ('buy-in', 'rebuy', 'addon', 'ticket')),
  constraint transactions_status_check check (status in ('paid', 'unpaid')),
  constraint transactions_dealer_hours_nonnegative check (dealer_hours >= 0)
);

create index if not exists transactions_tournament_id_idx on public.transactions (tournament_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_status_idx on public.transactions (status);
create index if not exists transactions_date_idx on public.transactions (date);

-- ---------------------------------------------------------------------------
-- logs  (admin action journal)
-- ---------------------------------------------------------------------------
create table if not exists public.logs (
  id text primary key default gen_random_uuid()::text,
  timestamp timestamptz not null default now(),
  admin_id text references public.users (id) on delete set null,
  admin_email text not null,
  admin_name text not null default '',
  action_type text not null,
  target_user_id text references public.users (id) on delete set null,
  target_user_email text,
  target_user_name text,
  target_tournament_id text references public.tournaments (id) on delete set null,
  target_tournament_name text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists logs_timestamp_idx on public.logs (timestamp desc);
create index if not exists logs_admin_id_idx on public.logs (admin_id);
create index if not exists logs_target_user_id_idx on public.logs (target_user_id);
create index if not exists logs_target_tournament_id_idx on public.logs (target_tournament_id);

-- ---------------------------------------------------------------------------
-- login_otp_requests  (server-only, HMAC hashes; never exposed to anon)
-- ---------------------------------------------------------------------------
create table if not exists public.login_otp_requests (
  email text primary key,
  code_hash text not null,
  request_ip_hash text not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5)
);

create index if not exists login_otp_requests_ip_time_idx
  on public.login_otp_requests (request_ip_hash, requested_at desc);

alter table public.login_otp_requests enable row level security;
revoke all on table public.login_otp_requests from public, anon, authenticated;
grant all on table public.login_otp_requests to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute procedure public.set_updated_at();

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at
  before update on public.participants
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — open read/write for now (tighten later)
-- Login uses the anon key against public.users (no Supabase Auth session).
-- Keep GRANT + policy for anon SELECT/INSERT/UPDATE or email OTP login will 401/403.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.tournaments enable row level security;
alter table public.participants enable row level security;
alter table public.transactions enable row level security;
alter table public.logs enable row level security;

drop policy if exists users_all_access on public.users;
create policy users_all_access on public.users
  for all using (true) with check (true);

drop policy if exists tournaments_all_access on public.tournaments;
create policy tournaments_all_access on public.tournaments
  for all using (true) with check (true);

drop policy if exists participants_all_access on public.participants;
create policy participants_all_access on public.participants
  for all using (true) with check (true);

drop policy if exists transactions_all_access on public.transactions;
create policy transactions_all_access on public.transactions
  for all using (true) with check (true);

drop policy if exists logs_all_access on public.logs;
create policy logs_all_access on public.logs
  for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on table public.users to anon, authenticated;
grant all on table public.tournaments to anon, authenticated;
grant all on table public.participants to anon, authenticated;
grant all on table public.transactions to anon, authenticated;
grant all on table public.logs to anon, authenticated;

-- ---------------------------------------------------------------------------
-- timer_sessions  (live blinds clock + club-wide blind structures)
-- ---------------------------------------------------------------------------
create table if not exists public.timer_sessions (
  id text primary key default 'live',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.timer_sessions (id, payload)
values
  ('live', '{}'::jsonb),
  ('blind-structures', '{}'::jsonb)
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
