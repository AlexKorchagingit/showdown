-- Phoenix rebuy is 1500 ₽ from the next charge onward.
-- Existing transaction rows are left untouched.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create or replace function club_private.is_phoenix(p_title text, p_structure text, p_structure_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_title, '') ~* 'phoenix|феникс'
      or coalesce(p_structure, '') ~* 'phoenix|феникс'
      or coalesce(p_structure_id, '') ~* 'phoenix';
$$;

create or replace function club_private.charge_amount(
  p_type text, p_title text, p_structure text, p_structure_id text
) returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type = 'ticket' then 0
    when club_private.is_freezeout(p_title, p_structure, p_structure_id) then 1200
    when p_type = 'rebuy' and club_private.is_phoenix(p_title, p_structure, p_structure_id) then 1500
    else 1000
  end;
$$;

revoke all on function club_private.is_phoenix(text, text, text) from public, anon, authenticated;
revoke all on function club_private.charge_amount(text, text, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
