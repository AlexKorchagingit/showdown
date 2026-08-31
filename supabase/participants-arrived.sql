-- Lobby check-in: a player reaches the cashier only after an admin ticks «пришёл».
-- Default TRUE so seats that already exist stay in the cashier.
-- Safe to re-run.

alter table public.participants
  add column if not exists arrived boolean not null default true;
