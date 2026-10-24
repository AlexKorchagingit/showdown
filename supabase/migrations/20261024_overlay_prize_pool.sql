-- Live overlay pool. Closed payouts stay on the guarantee they were paid with.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function club_private.overlay_series_key(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(coalesce(p_title, '')) like '%TEAM%' then 'team'
    when upper(coalesce(p_title, '')) like '%CHILL%' then 'chill'
    when upper(coalesce(p_title, '')) like '%PHOENIX%' then 'phoenix'
    when upper(coalesce(p_title, '')) like '%FREEZE%' then 'freezeout'
    when upper(coalesce(p_title, '')) like '%DEEP%' then 'deepstack'
    when upper(coalesce(p_title, '')) like '%BOUNTY%'
      or upper(coalesce(p_title, '')) like '%MYSTERY%' then 'bounty'
    when upper(coalesce(p_title, '')) like '%TRIPLE%' then 'triple'
    when upper(coalesce(p_title, '')) like '%FREEROLL%' then 'freeroll'
    else 'title:' || upper(btrim(coalesce(p_title, '')))
  end;
$$;

revoke all on function club_private.overlay_series_key(text) from public, anon, authenticated;

-- Cashier field: checked in, or already given a place.
create or replace function club_private.overlay_field_size(p_tournament_id text)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.participants p
  where p.tournament_id = p_tournament_id
    and (p.arrived or (p.place is not null and p.place >= 1));
$$;

revoke all on function club_private.overlay_field_size(text) from public, anon, authenticated;

-- Base is the ordinary night. People above the series average add a full overlay.
-- Every rebuy adds half, every addon a quarter, including on an ordinary night.
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
     or v_t.overlay_per_head is null
     or club_private.is_team_battle(v_t.title, v_t.blind_structure) then
    return greatest(0, coalesce(v_t.guarantee, 0));
  end if;

  v_base := greatest(0, coalesce(v_t.overlay_base, v_t.guarantee, 0));
  v_per := greatest(0, v_t.overlay_per_head);
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

create or replace function public.club_close_tournament(
  p_request_id uuid, p_tournament_id text, p_results jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_tournament public.tournaments%rowtype;
  v_payload jsonb;
  v_previous record;
  v_result jsonb;
  v_players integer;
  v_pool integer;
  v_ruby_total bigint := 0;
  v_row record;
  v_points integer;
  v_rubies integer;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id = v_actor->>'id' for share;
  if v_role not in ('admin', 'superadmin') then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id) = ''
    or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) = 0 then
    raise exception using errcode = '22023', message = 'Invalid tournament closure';
  end if;
  if exists(select 1 from jsonb_array_elements(p_results) item where jsonb_typeof(item) <> 'object'
    or not item ?& array['id', 'place', 'knockouts']
    or item - array['id', 'place', 'knockouts']::text[] <> '{}'::jsonb
    or jsonb_typeof(item->'id') <> 'string'
    or jsonb_typeof(item->'place') <> 'number'
    or jsonb_typeof(item->'knockouts') <> 'number') then
    raise exception using errcode = '22023', message = 'Invalid tournament results';
  end if;
  if exists(select 1 from jsonb_array_elements(p_results) item
    where btrim(item->>'id') = '' or (item->>'place')::numeric <> trunc((item->>'place')::numeric)
      or (item->>'knockouts')::numeric <> trunc((item->>'knockouts')::numeric)
      or (item->>'place')::numeric not between 1 and 2147483647
      or (item->>'knockouts')::numeric not between 0 and 10000) then
    raise exception using errcode = '22023', message = 'Invalid tournament results';
  end if;
  select jsonb_agg(jsonb_build_object('id', item->>'id', 'place', (item->>'place')::integer,
    'knockouts', (item->>'knockouts')::integer) order by item->>'id') into v_payload
    from jsonb_array_elements(p_results) item;
  v_payload := jsonb_build_object('tournament_id', p_tournament_id, 'results', v_payload);

  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception using errcode = '22023', message = 'Unknown tournament'; end if;
  select payload, result into v_previous from club_private.tournament_close_requests
    where actor_id = v_actor->>'id' and request_id = p_request_id;
  if found then
    if v_previous.payload <> v_payload then
      raise exception using errcode = '22023', message = 'Request identifier already used';
    end if;
    return v_previous.result;
  end if;
  if v_tournament.is_closed or v_tournament.results_entered or v_tournament.rubies_distributed then
    raise exception using errcode = '55000', message = 'Tournament is already closed';
  end if;
  perform 1 from public.participants where tournament_id = p_tournament_id order by id for update;
  select count(*) into v_players from public.participants
    where tournament_id = p_tournament_id and arrived = true;
  if v_players = 0 or jsonb_array_length(p_results) <> v_players
    or (select count(distinct item->>'id') from jsonb_array_elements(p_results) item) <> v_players
    or (select count(distinct (item->>'place')::integer) from jsonb_array_elements(p_results) item) <> v_players
    or (select min((item->>'place')::integer) from jsonb_array_elements(p_results) item) <> 1
    or (select max((item->>'place')::integer) from jsonb_array_elements(p_results) item) <> v_players
    or exists(select 1 from jsonb_array_elements(p_results) item left join public.participants p
      on p.id = item->>'id' and p.tournament_id = p_tournament_id and p.arrived = true where p.id is null) then
    raise exception using errcode = '22023', message = 'Results must cover every arrived participant and place exactly once';
  end if;

  perform 1 from public.transactions where tournament_id = p_tournament_id order by id for update;
  v_pool := club_private.overlay_prize_pool(p_tournament_id);
  if v_pool is null or v_pool < 0 then
    v_pool := greatest(0, coalesce(v_tournament.guarantee, 0));
  end if;
  if v_pool is distinct from v_tournament.guarantee then
    update public.tournaments set guarantee = v_pool where id = p_tournament_id;
  end if;

  perform 1 from public.users u join public.participants p on p.user_id = u.id
    where p.tournament_id = p_tournament_id order by u.id for update of u;
  for v_row in
    select p.id, p.user_id, r.place, r.knockouts, p.rating, u.ruby_balance
    from public.participants p
    join jsonb_to_recordset(p_results) as r(id text, place integer, knockouts integer) on r.id = p.id
    left join public.users u on u.id = p.user_id
    where p.tournament_id = p_tournament_id and p.arrived = true order by p.id
  loop
    v_points := club_private.tournament_place_points(v_row.place, v_players, v_pool)
      + case when v_tournament.is_bounty then v_row.knockouts * 100 else 0 end;
    v_rubies := club_private.tournament_rubies(v_row.place, v_players, v_row.knockouts, v_tournament.is_bounty);
    if v_row.rating > 2147483647 - v_points
      or (v_row.user_id is not null and v_row.ruby_balance > 2147483647 - v_rubies) then
      raise exception using errcode = '22003', message = 'Tournament award overflow';
    end if;
    update public.participants set place = v_row.place,
      knockouts = case when v_tournament.is_bounty then v_row.knockouts else 0 end,
      rating = rating + v_points, rubies_awarded = v_rubies where id = v_row.id;
    if v_row.user_id is not null then
      update public.users set ruby_balance = ruby_balance + v_rubies where id = v_row.user_id;
      v_ruby_total := v_ruby_total + v_rubies;
    end if;
  end loop;
  if club_private.is_team_battle(v_tournament.title, v_tournament.blind_structure) then
    perform club_private.apply_team_battle_overlay(p_tournament_id, v_players, v_pool);
  end if;
  update public.tournaments set is_closed = true, results_entered = true, rubies_distributed = true
    where id = p_tournament_id;
  insert into public.logs(admin_id, admin_email, admin_name, action_type, target_tournament_id, target_tournament_name, details)
  values(v_actor->>'id', v_actor->>'email', v_actor->>'nickname', 'Закрыл турнир', v_tournament.id,
    v_tournament.title, jsonb_build_object('players', v_players, 'credited_rubies', v_ruby_total, 'guarantee', v_pool)::text);
  v_result := jsonb_build_object('request_id', p_request_id, 'tournament_id', v_tournament.id,
    'players', v_players, 'credited_rubies', v_ruby_total);
  insert into club_private.tournament_close_requests(actor_id, request_id, tournament_id, payload, result)
    values(v_actor->>'id', p_request_id, v_tournament.id, v_payload, v_result);
  return v_result;
end $$;

revoke all on function public.club_close_tournament(uuid, text, jsonb) from public, anon;
grant execute on function public.club_close_tournament(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
