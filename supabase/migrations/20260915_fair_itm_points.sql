-- Award ITM points strictly by place: a later bust-out never beats an earlier one.
-- Mirrors PAYOUT_TEMPLATES in src/data/prizeStructure.ts.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $guard$
begin
  if not pg_catalog.pg_has_role(
    current_user,
    (
      select p.proowner
      from pg_catalog.pg_proc p
      where p.oid='club_private.tournament_place_points(integer,integer,integer)'::regprocedure
    ),
    'USAGE'
  ) then
    raise exception 'Запустите миграцию ролью-владельцем club_private.tournament_place_points';
  end if;
end
$guard$;

create or replace function club_private.tournament_place_points(
  p_place integer,p_players integer,p_guarantee integer
) returns integer language plpgsql immutable set search_path='' as $$
declare
  v_places integer;
  v_shares numeric[];
  v_tail numeric;
  v_share_sum numeric:=0;
  v_rounded_sum integer:=0;
  v_award integer:=0;
  v_index integer;
begin
  if p_place<1 or p_players<1 or p_guarantee<=0 then return 0; end if;
  v_places:=ceil(p_players::numeric*0.35)::integer;
  if p_place>v_places then return 0; end if;
  v_shares:=case v_places
    when 1 then array[1]::numeric[]
    when 2 then array[0.65,0.35]::numeric[]
    when 3 then array[0.50,0.30,0.20]::numeric[]
    when 4 then array[0.42,0.28,0.18,0.12]::numeric[]
    when 5 then array[0.38,0.25,0.17,0.12,0.08]::numeric[]
    when 6 then array[0.34,0.22,0.15,0.12,0.09,0.08]::numeric[]
    when 7 then array[0.32,0.20,0.14,0.11,0.09,0.08,0.06]::numeric[]
    when 8 then array[0.28,0.19,0.13,0.10,0.09,0.08,0.07,0.06]::numeric[]
    when 9 then array[0.28,0.19,0.13,0.10,0.08,0.07,0.06,0.05,0.04]::numeric[]
    when 10 then array[0.27,0.18,0.125,0.095,0.08,0.07,0.06,0.05,0.04,0.03]::numeric[]
    when 11 then array[0.26,0.175,0.12,0.095,0.08,0.07,0.06,0.05,0.04,0.03,0.02]::numeric[]
    else array[0.25,0.17,0.115,0.09,0.075,0.065,0.055,0.05,0.04,0.035,0.03,0.025]::numeric[]
  end;
  if v_places>12 then
    v_tail:=v_shares[12];
    for v_index in 13..v_places loop
      v_tail:=round(v_tail*0.85,6);
      v_shares:=array_append(v_shares,v_tail);
    end loop;
  end if;
  select sum(value) into v_share_sum from unnest(v_shares) value;
  for v_index in 1..v_places loop
    v_rounded_sum:=v_rounded_sum+round(p_guarantee*v_shares[v_index]/v_share_sum)::integer;
    if v_index=p_place then v_award:=round(p_guarantee*v_shares[v_index]/v_share_sum)::integer; end if;
  end loop;
  if p_place=1 then v_award:=greatest(0,v_award+p_guarantee-v_rounded_sum); end if;
  return v_award;
end $$;

-- Closed tournaments keep the credited points in participants.rating, so the
-- stored awards are rewritten from the same table the lobby now shows.
do $backfill$
declare v_rows integer;
begin
  if club_private.tournament_place_points(8,22,12000)<>720 then
    raise exception 'Функция начисления очков не обновилась';
  end if;
  with field as (
    select p.tournament_id,
           count(*) filter (where p.arrived or p.place is not null) as players
    from public.participants p
    group by p.tournament_id
  ), target as (
    select p.id,
           club_private.tournament_place_points(
             coalesce(p.place,0),greatest(1,f.players::integer),t.guarantee
           )+case when t.is_bounty then coalesce(p.knockouts,0)*100 else 0 end as rating
    from public.participants p
    join public.tournaments t on t.id=p.tournament_id and t.results_entered
    join field f on f.tournament_id=p.tournament_id
  )
  update public.participants p set rating=target.rating
  from target where target.id=p.id and p.rating<>target.rating;
  get diagnostics v_rows=row_count;
  raise notice 'Пересчитано начисленных очков: %', v_rows;
end
$backfill$;

commit;
