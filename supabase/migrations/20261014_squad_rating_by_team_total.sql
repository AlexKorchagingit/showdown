-- Personal rating follows the team's total points, not the headcount.
-- A five-player winning team is no longer paid less per person than a
-- three-player team with a smaller score. Teammates still share one number.
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
  weight as (
    select coalesce(sum(points * members), 0) as total from teams
  ),
  pool as (
    select greatest(0, coalesce(t.guarantee, 0))::numeric as amount
    from public.tournaments t
    where t.id = 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0'
  )
  select m.id,
         case when weight.total > 0
           then floor(pool.amount * teams.points / weight.total)::integer
           else 0 end
  from members m
  join teams on teams.squad_no = m.squad_no
  cross join weight
  cross join pool
$$;

revoke all on function club_private.oct13_squad_awards() from public, anon, authenticated;

select club_private.apply_oct13_squad_ratings();

notify pgrst, 'reload schema';
commit;
