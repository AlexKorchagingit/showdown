-- TEAM BATTLE: both teammates of a place get the same floor-half. Recorrect closed events.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';

create or replace function club_private.team_battle_share(
  p_team_rank integer,p_place integer,p_partner_place integer,p_players integer,p_guarantee integer
) returns integer language plpgsql immutable set search_path='' as $$
declare v_pool integer;
begin
  if p_team_rank is null or p_team_rank<1 or p_place is null or p_place<1 then return 0; end if;
  v_pool:=club_private.tournament_place_points(p_team_rank,p_players,p_guarantee);
  if p_partner_place is null or p_partner_place<1 then return v_pool; end if;
  return v_pool/2;
end $$;
revoke all on function club_private.team_battle_share(integer,integer,integer,integer,integer) from public,anon,authenticated;

do $$
declare
  v_script constant text:='team-battle-even-split-once';
  v_t record;
  v_src jsonb;
  v_players integer;
  v_row record;
  v_pool integer;
  v_old integer;
  v_new integer;
  v_delta integer;
  v_changes jsonb:='[]'::jsonb;
begin
  if exists(select 1 from public.logs where details like '%'||v_script||'%') then
    raise notice 'Already applied %', v_script;
    return;
  end if;

  for v_t in
    select t.id, t.title, t.guarantee
    from public.tournaments t
    where t.results_entered
      and club_private.is_team_battle(t.title, t.blind_structure)
    order by t.id
    for update
  loop
    select count(*)::integer into v_players
      from public.participants p where p.tournament_id=v_t.id and p.arrived;
    if v_players is null or v_players<1 then continue; end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'ident',club_private.seat_identity(v_t.id,p.id,p.user_id),
      'place',p.place,'team_partner_id',p.team_partner_id)),'[]'::jsonb)
    into v_src from public.participants p where p.tournament_id=v_t.id and p.arrived;

    for v_row in
      select p.id, p.nickname, p.rating, r.team_rank, r.place, r.partner_place
      from public.participants p
      join club_private.team_battle_rank_rows(v_src) r
        on r.ident=club_private.seat_identity(v_t.id,p.id,p.user_id)
      where p.tournament_id=v_t.id and p.arrived
    loop
      v_pool:=club_private.tournament_place_points(v_row.team_rank,v_players,v_t.guarantee);
      if v_row.partner_place is null or v_row.partner_place<1 then
        v_old:=v_pool; v_new:=v_pool;
      else
        v_old:=v_pool/2 + case when v_row.place<v_row.partner_place then v_pool%2 else 0 end;
        v_new:=v_pool/2;
      end if;
      v_delta:=v_new-v_old;
      if v_delta=0 then continue; end if;
      update public.participants set rating=rating+v_delta where id=v_row.id;
      v_changes:=v_changes||jsonb_build_object(
        'tournament_id',v_t.id,'nickname',v_row.nickname,'place',v_row.place,
        'from',v_row.rating,'to',v_row.rating+v_delta,'delta',v_delta);
    end loop;
  end loop;

  insert into public.logs(admin_email,admin_name,action_type,details)
  values('script@local','team-battle-even-split','Переначислил очки TEAM BATTLE',
    jsonb_build_object('script',v_script,'changes',v_changes)::text);
end $$;

notify pgrst,'reload schema';
commit;
