-- Remember an overlay plan on a tournament without rewriting a closed payout.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tournaments
  add column if not exists overlay_base integer,
  add column if not exists overlay_per_head integer;

alter table public.tournaments
  drop constraint if exists tournaments_overlay_base_range;
alter table public.tournaments
  add constraint tournaments_overlay_base_range
  check (overlay_base is null or overlay_base between 0 and 2147483647);

alter table public.tournaments
  drop constraint if exists tournaments_overlay_per_head_range;
alter table public.tournaments
  add constraint tournaments_overlay_per_head_range
  check (overlay_per_head is null or overlay_per_head between 0 and 100000);

create or replace function public.club_save_tournament_overlay(
  p_tournament_id text,
  p_base integer,
  p_per_head integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_t public.tournaments%rowtype;
  v_locked boolean;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  select role into v_role from club_private.profile_roles where user_id = v_actor->>'id';
  if v_role not in ('admin', 'superadmin') then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  if p_tournament_id is null or btrim(p_tournament_id) = ''
     or p_base is null or p_base < 0 or p_base > 2147483647
     or p_per_head is null or p_per_head < 0 or p_per_head > 100000 then
    raise exception using errcode = '22023', message = 'Invalid overlay';
  end if;
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  v_locked := v_t.is_closed or v_t.results_entered or v_t.rubies_distributed;
  update public.tournaments
  set overlay_base = p_base,
      overlay_per_head = p_per_head,
      guarantee = case when v_locked then guarantee else p_base end
  where id = p_tournament_id
  returning * into v_t;
  return jsonb_build_object(
    'guarantee', v_t.guarantee,
    'overlay_base', v_t.overlay_base,
    'overlay_per_head', v_t.overlay_per_head,
    'guarantee_locked', v_locked
  );
end;
$$;

revoke all on function public.club_save_tournament_overlay(text, integer, integer) from public, anon;
grant execute on function public.club_save_tournament_overlay(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
