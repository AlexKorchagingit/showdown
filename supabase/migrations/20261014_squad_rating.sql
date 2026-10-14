-- Recalculate the 13 Oct freeroll's awarded rating whenever its team points are saved.
-- Place prizes from closing the event are replaced by the six-team split.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create or replace function club_private.oct13_squad_awards()
returns table(seat_id text, award integer)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select p.id,
           p.squad_no,
           greatest(0, least(coalesce(p.squad_points, 0), 1000000))::numeric as points
    from public.participants p
    where p.tournament_id = 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0'
      and p.squad_no between 1 and 6
  ),
  teams as (
    select squad_no, sum(points) as points, count(*)::integer as members
    from members
    group by squad_no
  ),
  totals as (
    select coalesce(sum(points), 0) as total from teams
  ),
  pool as (
    select greatest(0, coalesce(t.guarantee, 0))::numeric as amount
    from public.tournaments t
    where t.id = 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0'
  ),
  raw as (
    select teams.squad_no,
           teams.members,
           case when totals.total > 0 then floor(pool.amount * teams.points / totals.total) else 0 end as base,
           case when totals.total > 0
             then (pool.amount * teams.points / totals.total)
                  - floor(pool.amount * teams.points / totals.total)
             else 0 end as rest
    from teams
    cross join totals
    cross join pool
  ),
  ranked as (
    select raw.*,
           row_number() over (order by raw.rest desc, raw.squad_no) as rn,
           (select pool.amount - coalesce(sum(raw.base), 0) from raw) as leftover
    from raw
    cross join pool
  ),
  team_award as (
    select squad_no,
           members,
           (base + case when rn <= leftover then 1 else 0 end)::integer as award
    from ranked
  )
  select m.id,
         case when ta.members > 0 then floor(ta.award::numeric / ta.members)::integer else 0 end
  from members m
  join team_award ta on ta.squad_no = m.squad_no
$$;

revoke all on function club_private.oct13_squad_awards() from public, anon, authenticated;

create or replace function club_private.apply_oct13_squad_ratings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  perform set_config('club.oct13_rating', '1', true);
  update public.participants p
  set rating = coalesce(a.award, 0)
  from (
    select p2.id as seat_id, a.award
    from public.participants p2
    left join club_private.oct13_squad_awards() a on a.seat_id = p2.id
    where p2.tournament_id = 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0'
  ) a
  where p.id = a.seat_id
    and p.rating is distinct from coalesce(a.award, 0);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function club_private.apply_oct13_squad_ratings() from public, anon, authenticated;

create or replace function club_private.keep_oct13_squad_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_award integer;
begin
  if new.tournament_id is distinct from 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0' then
    return new;
  end if;
  if current_setting('club.oct13_rating', true) = '1' then
    return new;
  end if;
  if new.squad_no is distinct from old.squad_no or new.squad_points is distinct from old.squad_points then
    return new;
  end if;
  select a.award into v_award
  from club_private.oct13_squad_awards() a
  where a.seat_id = new.id;
  new.rating := coalesce(v_award, 0);
  return new;
end;
$$;

revoke all on function club_private.keep_oct13_squad_rating() from public, anon, authenticated;

drop trigger if exists participants_keep_oct13_squad_rating on public.participants;
create trigger participants_keep_oct13_squad_rating
before update on public.participants
for each row
execute function club_private.keep_oct13_squad_rating();

create or replace function public.club_save_squad_scores(p_tournament_id text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_t public.tournaments%rowtype;
  v_updated integer := 0;
  v_ratings integer := 0;
begin
  if p_tournament_id is distinct from 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0' then
    raise exception using errcode = '22023', message = 'Командный зачёт есть только у турнира 13 октября';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception using errcode = '22023', message = 'Некорректный командный зачёт';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) x
    where jsonb_typeof(x) <> 'object'
      or not x ?& array['seat_id', 'squad_no', 'squad_points']
      or x - array['seat_id', 'squad_no', 'squad_points']::text[] <> '{}'::jsonb
      or jsonb_typeof(x->'seat_id') <> 'string'
      or jsonb_typeof(x->'squad_no') not in ('number', 'null')
      or jsonb_typeof(x->'squad_points') <> 'number'
  ) then
    raise exception using errcode = '22023', message = 'Некорректный командный зачёт';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found or v_t.start_date <> date '2026-10-13' then
    raise exception using errcode = '22023', message = 'Командный зачёт есть только у турнира 13 октября';
  end if;

  create temporary table squad_desired(
    seat_id text primary key,
    squad_no smallint,
    squad_points integer
  ) on commit drop;
  insert into squad_desired(seat_id, squad_no, squad_points)
  select btrim(x->>'seat_id'),
    case when jsonb_typeof(x->'squad_no') = 'number' then (x->>'squad_no')::smallint end,
    (x->>'squad_points')::integer
  from jsonb_array_elements(p_rows) x;
  if exists (
    select 1 from squad_desired
    where seat_id = ''
      or squad_points is null
      or squad_points < 0
      or squad_points > 1000000
      or (squad_no is not null and squad_no not between 1 and 6)
  ) then
    raise exception using errcode = '22023', message = 'Некорректные очки или номер команды';
  end if;
  if exists (
    select 1 from squad_desired d
    where not exists (
      select 1 from public.participants p
      where p.tournament_id = p_tournament_id and p.id = d.seat_id
    )
  ) then
    raise exception using errcode = '22023', message = 'В зачёте есть игрок не из этого турнира';
  end if;

  update public.participants p
  set squad_no = d.squad_no,
      squad_points = d.squad_points
  from squad_desired d
  where p.tournament_id = p_tournament_id and p.id = d.seat_id;
  get diagnostics v_updated = row_count;

  v_ratings := club_private.apply_oct13_squad_ratings();

  insert into public.logs(
    admin_id, admin_email, admin_name, action_type,
    target_tournament_id, target_tournament_name, details
  ) values (
    v_actor->>'id', v_actor->>'email', v_actor->>'nickname',
    'Сохранил командный зачёт', v_t.id, v_t.title,
    jsonb_build_object('players', v_updated, 'ratings', v_ratings)::text
  );

  return jsonb_build_object('tournament_id', v_t.id, 'updated', v_updated, 'ratings', v_ratings);
end $$;

revoke all on function public.club_save_squad_scores(text, jsonb) from public, anon;
grant execute on function public.club_save_squad_scores(text, jsonb) to authenticated;

select club_private.apply_oct13_squad_ratings();

notify pgrst, 'reload schema';
commit;
