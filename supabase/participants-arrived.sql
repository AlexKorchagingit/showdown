-- Lobby check-in: a player reaches the cashier only after an admin ticks «пришёл».
-- Default FALSE so existing seats stay in the lobby until they are checked in.
-- Safe to re-run.

alter table public.participants
  add column if not exists arrived boolean not null default false;
