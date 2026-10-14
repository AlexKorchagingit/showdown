-- One-off for FREEROLL TEAM BATTLE on 13 Oct 2026.
-- Place in the profile history becomes the team's rank by total points.
-- Rubies granted for individual bust-outs are taken back and paid again
-- from a slightly larger pot, using the same team-total split as rating.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $$
declare
  v_tournament constant text := 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0';
  v_pool constant integer := 10000;
  v_old integer;
  v_new integer;
  v_clamped integer;
  v_logged integer;
begin
  if exists (
    select 1 from public.logs
    where action_type = 'Пересчитал места и рубины командного турнира'
      and target_tournament_id = v_tournament
  ) then
    return;
  end if;

  perform set_config('club.oct13_rating', '1', true);

  create temporary table squad_ruby_plan(
    seat_id text primary key,
    user_id text,
    squad_no smallint,
    team_place integer,
    old_rubies integer,
    new_rubies integer
  ) on commit drop;

  insert into squad_ruby_plan(seat_id, user_id, squad_no, team_place, old_rubies, new_rubies)
  with members as (
    select p.id, p.user_id, p.squad_no, coalesce(p.rubies_awarded, 0) as old_rubies,
           greatest(0, least(coalesce(p.squad_points, 0), 1000000))::numeric as points
    from public.participants p
    where p.tournament_id = v_tournament
      and p.squad_no between 1 and 6
  ),
  teams as (
    select squad_no, sum(points) as points, count(*)::integer as members
    from members
    group by squad_no
  ),
  weight as (
    select coalesce(sum(points * members), 0) as total from teams
  ),
  ranked as (
    select squad_no,
           row_number() over (order by points desc, squad_no) as team_place,
           case when weight.total > 0
             then floor(v_pool * points / weight.total)::integer
             else 0 end as award
    from teams
    cross join weight
  )
  select m.id, m.user_id, m.squad_no, r.team_place, m.old_rubies, r.award
  from members m
  join ranked r on r.squad_no = m.squad_no;

  update public.participants p
  set place = d.team_place,
      rubies_awarded = d.new_rubies
  from squad_ruby_plan d
  where p.id = d.seat_id
    and p.tournament_id = v_tournament;

  select count(*) into v_clamped
  from squad_ruby_plan d
  join public.users u on u.id = d.user_id
  where u.ruby_balance - d.old_rubies + d.new_rubies < 0;

  update public.users u
  set ruby_balance = greatest(0, u.ruby_balance - d.old_rubies + d.new_rubies)
  from squad_ruby_plan d
  where d.user_id is not null
    and u.id = d.user_id;

  select coalesce(sum(old_rubies), 0), coalesce(sum(new_rubies), 0)
    into v_old, v_new
  from squad_ruby_plan;

  perform club_private.apply_oct13_squad_ratings();

  insert into public.logs(
    admin_id, admin_email, admin_name, action_type,
    target_tournament_id, target_tournament_name, details
  )
  select l.admin_id, l.admin_email, l.admin_name,
         'Пересчитал места и рубины командного турнира',
         t.id, t.title,
         jsonb_build_object(
           'ruby_pool', v_pool,
           'old_rubies', v_old,
           'new_rubies', v_new,
           'balances_floored', v_clamped
         )::text
  from public.tournaments t
  join public.logs l on l.target_tournament_id = t.id
    and l.action_type = 'Сохранил командный зачёт'
  where t.id = v_tournament
  order by l.created_at desc
  limit 1;
  get diagnostics v_logged = row_count;
  if v_logged <> 1 then
    raise exception 'Не удалось записать журнал пересчёта';
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
