-- A night with no saved overlay still uses the series rate, or 100 when the series has none.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function club_private.overlay_prize_pool(p_tournament_id text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_t public.tournaments%rowtype;
  v_nights integer := 0;
  v_norm integer := 17;
  v_people integer := 0;
  v_rebuys integer := 0;
  v_addons integer := 0;
  v_base integer;
  v_per integer;
  v_pool bigint;
begin
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then return 0; end if;
  if v_t.is_closed or v_t.results_entered or v_t.rubies_distributed
     or club_private.is_team_battle(v_t.title, v_t.blind_structure) then
    return greatest(0, coalesce(v_t.guarantee, 0));
  end if;

  v_base := greatest(0, coalesce(v_t.overlay_base, v_t.guarantee, 0));
  v_per := v_t.overlay_per_head;
  if v_per is null then
    select n.overlay_per_head into v_per
    from public.tournaments n
    where n.id <> v_t.id
      and n.overlay_per_head is not null
      and club_private.overlay_series_key(n.title) = club_private.overlay_series_key(v_t.title)
    order by n.start_date desc nulls last, n.id desc
    limit 1;
  end if;
  if v_per is null then
    v_per := 100;
  end if;
  v_per := greatest(0, v_per);

  select count(*)::integer,
         round(avg(field))::integer
    into v_nights, v_norm
  from (
    select club_private.overlay_field_size(n.id) as field
    from public.tournaments n
    where n.is_closed
      and n.id <> v_t.id
      and club_private.overlay_series_key(n.title) = club_private.overlay_series_key(v_t.title)
  ) nights
  where field > 0;
  if coalesce(v_nights, 0) = 0 or v_norm is null then
    v_norm := 17;
  end if;

  v_people := club_private.overlay_field_size(v_t.id);
  select coalesce((count(*) filter (where x.type = 'rebuy'))::integer, 0),
         coalesce((count(*) filter (where x.type = 'addon'))::integer, 0)
    into v_rebuys, v_addons
  from public.transactions x
  where x.tournament_id = v_t.id
    and x.type in ('rebuy', 'addon')
    and not exists (
      select 1 from club_private.transaction_voids v where v.transaction_id = x.id
    );

  v_pool := v_base
    + greatest(0, v_people - v_norm)::bigint * v_per
    + coalesce(v_rebuys, 0)::bigint * round(v_per / 2.0)::integer
    + coalesce(v_addons, 0)::bigint * round(v_per / 4.0)::integer;
  if v_pool > 2147483647 then return 2147483647; end if;
  if v_pool < 0 then return 0; end if;
  return v_pool::integer;
end;
$$;

revoke all on function club_private.overlay_prize_pool(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
