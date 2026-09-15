-- Correct the eight-place payout: eighth place must receive less than seventh.
-- Future closures use the corrected function; settled tournaments are untouched.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function club_private.tournament_place_points(
  p_place integer,p_players integer,p_guarantee integer
) returns integer language plpgsql immutable set search_path='' as $$
declare
  v_places integer;
  v_shares numeric[];
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
    when 7 then array[0.32,0.20,0.14,0.11,0.09,0.07,0.07]::numeric[]
    when 8 then array[0.29,0.18,0.13,0.10,0.09,0.08,0.07,0.06]::numeric[]
    else array[0.27,0.17,0.12,0.10,0.08,0.07,0.06,0.05,0.04]::numeric[]
  end;
  if v_places>9 then
    for v_index in 10..v_places loop
      v_shares:=array_append(v_shares,case v_index when 10 then 0.04 when 11 then 0.03 else 0.02 end);
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

revoke all on function club_private.tournament_place_points(integer,integer,integer) from public,anon,authenticated;
commit;
