-- Compact TEAM BATTLE places: rank finished teams 1,2,3… instead of raw min(place).
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';

create or replace function club_private.team_battle_rank_rows(p_rows jsonb)
returns table(ident text, team_rank integer, place integer, partner_place integer)
language sql immutable set search_path='' as $$
  with seats as (
    select x.ident, x.place, nullif(x.team_partner_id,'') as team_partner_id,
      (select y.place from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb))
         as y(ident text, place integer, team_partner_id text)
       where y.ident=nullif(x.team_partner_id,'') limit 1) as partner_place
    from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb))
      as x(ident text, place integer, team_partner_id text)
    where x.ident is not null and btrim(x.ident)<>''
  ),
  keyed as (
    select ident, place, partner_place, team_partner_id,
      case
        when team_partner_id is null then place
        when partner_place is null then null
        else least(place, partner_place)
      end as team_min,
      case
        when team_partner_id is null then ident
        else least(ident, team_partner_id)
      end as team_key
    from seats
  ),
  alive as (
    select count(distinct team_key)::integer as n from keyed where team_min is null
  ),
  unique_teams as (
    select team_key, min(team_min) as team_min
    from keyed where team_min is not null
    group by team_key
  ),
  ranked as (
    select u.team_key, coalesce((select n from alive),0) + dense_rank() over (order by u.team_min) as team_rank
    from unique_teams u
  )
  select k.ident, r.team_rank, k.place, k.partner_place
  from keyed k
  join ranked r on r.team_key=k.team_key
  where k.team_min is not null;
$$;

create or replace function club_private.team_battle_share(
  p_team_rank integer,p_place integer,p_partner_place integer,p_players integer,p_guarantee integer
) returns integer language plpgsql immutable set search_path='' as $$
declare v_pool integer;
begin
  if p_team_rank is null or p_team_rank<1 or p_place is null or p_place<1 then return 0; end if;
  v_pool:=club_private.tournament_place_points(p_team_rank,p_players,p_guarantee);
  if p_partner_place is null or p_partner_place<1 then return v_pool; end if;
  if p_place<p_partner_place then return (v_pool/2)+(v_pool%2); end if;
  return v_pool/2;
end $$;

revoke all on function club_private.team_battle_rank_rows(jsonb) from public,anon,authenticated;
revoke all on function club_private.team_battle_share(integer,integer,integer,integer,integer) from public,anon,authenticated;

create or replace function club_private.apply_team_battle_overlay(
  p_tournament_id text,p_players integer,p_guarantee integer
) returns void language plpgsql set search_path='' as $$
declare v_src jsonb; v_row record; v_place_points integer; v_share integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'ident',club_private.seat_identity(p_tournament_id,p.id,p.user_id),
    'place',p.place,'team_partner_id',p.team_partner_id)),'[]'::jsonb)
  into v_src from public.participants p where p.tournament_id=p_tournament_id and p.arrived;
  for v_row in
    select p.id,p.place,r.team_rank,r.partner_place
    from public.participants p
    join club_private.team_battle_rank_rows(v_src) r
      on r.ident=club_private.seat_identity(p_tournament_id,p.id,p.user_id)
    where p.tournament_id=p_tournament_id and p.arrived
  loop
    v_place_points:=club_private.tournament_place_points(v_row.place,p_players,p_guarantee);
    v_share:=club_private.team_battle_share(v_row.team_rank,v_row.place,v_row.partner_place,p_players,p_guarantee);
    update public.participants set rating=rating-v_place_points+v_share where id=v_row.id;
  end loop;
end $$;
revoke all on function club_private.apply_team_battle_overlay(text,integer,integer) from public,anon,authenticated;

create or replace function public.club_replace_participants(p_request_id uuid,p_tournament_id text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account(); v_role text; v_t public.tournaments%rowtype;
  v_payload jsonb; v_old record; v_result jsonb; v record; v_rating integer; v_rubies integer;
  v_team_battle boolean; v_players integer; v_adj record; v_old_share integer; v_new_share integer;
  v_old_ko integer; v_new_ko integer; v_old_src jsonb; v_new_src jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)='' or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows)>500 then raise exception using errcode='22023',message='Invalid participant request'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x)<>'object'
    or not x ?& array['seat_id','source_id','user_id','nickname','place','knockouts','comment','arrived']
    or x-array['seat_id','source_id','user_id','nickname','place','knockouts','comment','arrived','team_partner_id']::text[]<>'{}'::jsonb
    or jsonb_typeof(x->'seat_id')<>'string' or jsonb_typeof(x->'nickname')<>'string'
    or jsonb_typeof(x->'knockouts')<>'number'
    or jsonb_typeof(x->'source_id') not in ('string','null') or jsonb_typeof(x->'user_id') not in ('string','null')
    or jsonb_typeof(x->'place') not in ('number','null') or jsonb_typeof(x->'comment') not in ('string','null')
    or jsonb_typeof(x->'arrived')<>'boolean'
    or (x ? 'team_partner_id' and jsonb_typeof(x->'team_partner_id') not in ('string','null'))) then
    raise exception using errcode='22023',message='Invalid participant rows'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where length(x->>'seat_id') not between 3 and 500
    or (x->>'knockouts')::numeric<>trunc((x->>'knockouts')::numeric) or (x->>'knockouts')::numeric not between 0 and 10000
    or (jsonb_typeof(x->'place')='number' and ((x->>'place')::numeric<>trunc((x->>'place')::numeric)
      or (x->>'place')::numeric not between 1 and 500))
    or length(coalesce(x->>'comment',''))>1000
    or (jsonb_typeof(x->'team_partner_id')='string' and length(x->>'team_partner_id')>200)) then
    raise exception using errcode='22023',message='Invalid participant values'; end if;
  select jsonb_agg(x order by x->>'seat_id') into v_payload from jsonb_array_elements(p_rows) x;
  v_payload:=jsonb_build_object('tournament_id',p_tournament_id,'rows',coalesce(v_payload,'[]'::jsonb));
  select * into v_t from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  v_team_battle:=club_private.is_team_battle(v_t.title,v_t.blind_structure);
  select payload,result into v_old from club_private.participant_requests where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then if v_old.payload<>v_payload then raise exception using errcode='22023',message='Request identifier already used'; end if; return v_old.result; end if;
  perform 1 from public.participants where tournament_id=p_tournament_id order by id for update;
  create temporary table old_team_state(
    id text,ident text,place integer,knockouts integer,team_partner_id text,arrived boolean
  ) on commit drop;
  insert into old_team_state
  select p.id,club_private.seat_identity(p_tournament_id,p.id,p.user_id),p.place,p.knockouts,p.team_partner_id,p.arrived
  from public.participants p where p.tournament_id=p_tournament_id;
  create temporary table desired_participants(source_id text,seat_id text primary key,user_id text,nickname text,
    place integer,knockouts integer,comment text,arrived boolean,team_partner_id text,partner_specified boolean not null) on commit drop;
  insert into desired_participants
  select nullif(x->>'source_id',''),x->>'seat_id',nullif(x->>'user_id',''),btrim(x->>'nickname'),
    case when jsonb_typeof(x->'place')='number' then (x->>'place')::integer end,
    (x->>'knockouts')::integer,
    case when jsonb_typeof(x->'comment')='string' then x->>'comment' end,
    (x->>'arrived')::boolean,
    case when x ? 'team_partner_id' then nullif(btrim(coalesce(x->>'team_partner_id','')),'') end,
    x ? 'team_partner_id'
  from jsonb_array_elements(p_rows) x;
  update desired_participants d set team_partner_id=(
    select club_private.seat_identity(p_tournament_id,n.seat_id,n.user_id)
    from public.participants old
    left join public.participants old_p on old_p.tournament_id=p_tournament_id
      and club_private.seat_identity(p_tournament_id,old_p.id,old_p.user_id)=old.team_partner_id
    left join desired_participants n on n.source_id=old_p.id
    where old.id=d.source_id)
  where not d.partner_specified and d.source_id is not null;
  update desired_participants d
    set team_partner_id=substring(d.team_partner_id from length(p_tournament_id)+2)
    where d.team_partner_id like p_tournament_id||':%';
  update desired_participants d set team_partner_id=null
  where d.team_partner_id is not null and not exists(
    select 1 from desired_participants o
    where club_private.seat_identity(p_tournament_id,o.seat_id,o.user_id)=d.team_partner_id
      and o.team_partner_id=club_private.seat_identity(p_tournament_id,d.seat_id,d.user_id)
      and o.arrived and d.arrived
      and club_private.seat_identity(p_tournament_id,o.seat_id,o.user_id)
        <>club_private.seat_identity(p_tournament_id,d.seat_id,d.user_id));
  if exists(select 1 from desired_participants d where d.seat_id not like p_tournament_id||':%'
      or (d.user_id is null and (substring(d.seat_id from length(p_tournament_id)+2) not like 'guest-%' or length(d.nickname) not between 2 and 17))
      or (d.user_id is not null and (d.seat_id<>p_tournament_id||':'||d.user_id or not exists(select 1 from public.users u where u.id=d.user_id))))
    or exists(select user_id from desired_participants where user_id is not null group by user_id having count(*)>1)
    or exists(select source_id from desired_participants where source_id is not null group by source_id having count(*)>1)
    or exists(select place from desired_participants where place is not null group by place having count(*)>1)
    or exists(select 1 from desired_participants d where d.source_id is not null and not exists(
      select 1 from public.participants p where p.tournament_id=p_tournament_id and p.id=d.source_id)) then
    raise exception using errcode='22023',message='Invalid participant identity or placement'; end if;
  update desired_participants d set nickname=u.nickname from public.users u where u.id=d.user_id;
  delete from public.participants p where p.tournament_id=p_tournament_id
    and not exists(select 1 from desired_participants d where d.source_id=p.id);
  for v in select d.*,p.rating old_rating,p.place old_place,p.knockouts old_knockouts,p.rubies_awarded old_rubies
    from desired_participants d left join public.participants p on p.id=d.source_id order by d.seat_id loop
    if v.source_id is not null then
      v_rating:=v.old_rating;
      if v_t.results_entered and not v_team_battle then v_rating:=v_rating
        -club_private.tournament_place_points(coalesce(v.old_place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        -case when v_t.is_bounty then v.old_knockouts*100 else 0 end
        +club_private.tournament_place_points(coalesce(v.place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        +case when v_t.is_bounty then v.knockouts*100 else 0 end; end if;
      v_rubies:=v.old_rubies;
      update public.participants set id=v.seat_id,user_id=v.user_id,nickname=v.nickname,rating=v_rating,
        place=v.place,knockouts=case when v_t.is_bounty then v.knockouts else 0 end,
        rubies_awarded=v_rubies,comment=nullif(btrim(coalesce(v.comment,'')),''),arrived=v.arrived,
        team_partner_id=nullif(btrim(coalesce(v.team_partner_id,'')),'') where id=v.source_id;
    else
      v_rating:=case when v_t.results_entered and not v_team_battle then
        club_private.tournament_place_points(coalesce(v.place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        +case when v_t.is_bounty then v.knockouts*100 else 0 end else 0 end;
      insert into public.participants(id,tournament_id,user_id,nickname,rating,place,knockouts,rubies_awarded,comment,arrived,team_partner_id)
      values(v.seat_id,p_tournament_id,v.user_id,v.nickname,v_rating,v.place,
        case when v_t.is_bounty then v.knockouts else 0 end,case when v_t.rubies_distributed then 0 else null end,
        nullif(btrim(coalesce(v.comment,'')),''),v.arrived,nullif(btrim(coalesce(v.team_partner_id,'')),''));
    end if;
  end loop;
  if v_t.results_entered and v_team_battle then
    v_players:=greatest(1,(select count(*)::integer from public.participants
      where tournament_id=p_tournament_id and arrived=true));
    select coalesce(jsonb_agg(jsonb_build_object(
      'ident',s.ident,'place',s.place,'team_partner_id',s.team_partner_id) order by s.ident),'[]'::jsonb)
      into v_old_src from old_team_state s where s.arrived;
    select coalesce(jsonb_agg(jsonb_build_object(
      'ident',club_private.seat_identity(p_tournament_id,p.id,p.user_id),
      'place',p.place,'team_partner_id',p.team_partner_id) order by p.id),'[]'::jsonb)
      into v_new_src from public.participants p
      where p.tournament_id=p_tournament_id and p.arrived;
    for v_adj in
      select p.id as new_id,p.place as new_place,p.knockouts as new_knockouts,
        r_new.team_rank as new_rank,r_new.partner_place as new_partner_place,
        s.place as old_place,s.knockouts as old_knockouts,
        r_old.team_rank as old_rank,r_old.partner_place as old_partner_place
      from public.participants p
      left join desired_participants d on d.seat_id=p.id
      left join old_team_state s on s.id=d.source_id
      left join club_private.team_battle_rank_rows(v_old_src) r_old on r_old.ident=s.ident
      left join club_private.team_battle_rank_rows(v_new_src) r_new
        on r_new.ident=club_private.seat_identity(p_tournament_id,p.id,p.user_id)
      where p.tournament_id=p_tournament_id
    loop
      v_old_share:=club_private.team_battle_share(
        v_adj.old_rank,v_adj.old_place,v_adj.old_partner_place,v_players,v_t.guarantee);
      v_new_share:=club_private.team_battle_share(
        v_adj.new_rank,v_adj.new_place,v_adj.new_partner_place,v_players,v_t.guarantee);
      v_old_ko:=case when v_t.is_bounty then coalesce(v_adj.old_knockouts,0)*100 else 0 end;
      v_new_ko:=case when v_t.is_bounty then coalesce(v_adj.new_knockouts,0)*100 else 0 end;
      update public.participants set rating=rating-coalesce(v_old_share,0)-v_old_ko+v_new_share+v_new_ko
        where id=v_adj.new_id;
    end loop;
  end if;
  if (select count(*) from desired_participants)>v_t.total_seats then
    update public.tournaments set total_seats=(select count(*) from desired_participants) where id=p_tournament_id; end if;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_tournament_id,target_tournament_name,details)
  values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Изменил состав турнира',v_t.id,v_t.title,
    jsonb_build_object('participants',(select count(*) from desired_participants))::text);
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',p_tournament_id,'participants',(select count(*) from desired_participants));
  insert into club_private.participant_requests values(v_actor->>'id',p_request_id,p_tournament_id,v_payload,v_result,clock_timestamp());
  return v_result;
end $$;
revoke all on function public.club_replace_participants(uuid,text,jsonb) from public,anon;
grant execute on function public.club_replace_participants(uuid,text,jsonb) to authenticated;

create or replace function public.club_close_tournament(
  p_request_id uuid,p_tournament_id text,p_results jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb:=public.club_current_account();
  v_role text;
  v_tournament public.tournaments%rowtype;
  v_payload jsonb;
  v_previous record;
  v_result jsonb;
  v_players integer;
  v_ruby_total bigint:=0;
  v_row record;
  v_points integer;
  v_rubies integer;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then
    raise exception using errcode='42501',message='Administrator required';
  end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)=''
    or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)=0 then
    raise exception using errcode='22023',message='Invalid tournament closure';
  end if;
  if exists(select 1 from jsonb_array_elements(p_results) item where jsonb_typeof(item)<>'object'
    or not item ?& array['id','place','knockouts']
    or item-array['id','place','knockouts']::text[]<>'{}'::jsonb
    or jsonb_typeof(item->'id')<>'string'
    or jsonb_typeof(item->'place')<>'number'
    or jsonb_typeof(item->'knockouts')<>'number') then
    raise exception using errcode='22023',message='Invalid tournament results';
  end if;
  if exists(select 1 from jsonb_array_elements(p_results) item
    where btrim(item->>'id')='' or (item->>'place')::numeric<>trunc((item->>'place')::numeric)
      or (item->>'knockouts')::numeric<>trunc((item->>'knockouts')::numeric)
      or (item->>'place')::numeric not between 1 and 2147483647
      or (item->>'knockouts')::numeric not between 0 and 10000) then
    raise exception using errcode='22023',message='Invalid tournament results';
  end if;
  select jsonb_agg(jsonb_build_object('id',item->>'id','place',(item->>'place')::integer,
    'knockouts',(item->>'knockouts')::integer) order by item->>'id') into v_payload
    from jsonb_array_elements(p_results) item;
  v_payload:=jsonb_build_object('tournament_id',p_tournament_id,'results',v_payload);

  select * into v_tournament from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  select payload,result into v_previous from club_private.tournament_close_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.payload<>v_payload then
      raise exception using errcode='22023',message='Request identifier already used';
    end if;
    return v_previous.result;
  end if;
  if v_tournament.is_closed or v_tournament.results_entered or v_tournament.rubies_distributed then
    raise exception using errcode='55000',message='Tournament is already closed';
  end if;
  perform 1 from public.participants where tournament_id=p_tournament_id order by id for update;
  select count(*) into v_players from public.participants
    where tournament_id=p_tournament_id and arrived=true;
  if v_players=0 or jsonb_array_length(p_results)<>v_players
    or (select count(distinct item->>'id') from jsonb_array_elements(p_results) item)<>v_players
    or (select count(distinct (item->>'place')::integer) from jsonb_array_elements(p_results) item)<>v_players
    or (select min((item->>'place')::integer) from jsonb_array_elements(p_results) item)<>1
    or (select max((item->>'place')::integer) from jsonb_array_elements(p_results) item)<>v_players
    or exists(select 1 from jsonb_array_elements(p_results) item left join public.participants p
      on p.id=item->>'id' and p.tournament_id=p_tournament_id and p.arrived=true where p.id is null) then
    raise exception using errcode='22023',message='Results must cover every arrived participant and place exactly once';
  end if;

  perform 1 from public.users u join public.participants p on p.user_id=u.id
    where p.tournament_id=p_tournament_id order by u.id for update of u;
  for v_row in
    select p.id,p.user_id,r.place,r.knockouts,p.rating,u.ruby_balance
    from public.participants p
    join jsonb_to_recordset(p_results) as r(id text,place integer,knockouts integer) on r.id=p.id
    left join public.users u on u.id=p.user_id
    where p.tournament_id=p_tournament_id and p.arrived=true order by p.id
  loop
    v_points:=club_private.tournament_place_points(v_row.place,v_players,v_tournament.guarantee)
      +case when v_tournament.is_bounty then v_row.knockouts*100 else 0 end;
    v_rubies:=club_private.tournament_rubies(v_row.place,v_players,v_row.knockouts,v_tournament.is_bounty);
    if v_row.rating>2147483647-v_points
      or (v_row.user_id is not null and v_row.ruby_balance>2147483647-v_rubies) then
      raise exception using errcode='22003',message='Tournament award overflow';
    end if;
    update public.participants set place=v_row.place,
      knockouts=case when v_tournament.is_bounty then v_row.knockouts else 0 end,
      rating=rating+v_points,rubies_awarded=v_rubies where id=v_row.id;
    if v_row.user_id is not null then
      update public.users set ruby_balance=ruby_balance+v_rubies where id=v_row.user_id;
      v_ruby_total:=v_ruby_total+v_rubies;
    end if;
  end loop;
  if club_private.is_team_battle(v_tournament.title,v_tournament.blind_structure) then
    perform club_private.apply_team_battle_overlay(p_tournament_id,v_players,v_tournament.guarantee);
  end if;
  update public.tournaments set is_closed=true,results_entered=true,rubies_distributed=true
    where id=p_tournament_id;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_tournament_id,target_tournament_name,details)
  values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Закрыл турнир',v_tournament.id,
    v_tournament.title,jsonb_build_object('players',v_players,'credited_rubies',v_ruby_total)::text);
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',v_tournament.id,
    'players',v_players,'credited_rubies',v_ruby_total);
  insert into club_private.tournament_close_requests(actor_id,request_id,tournament_id,payload,result)
    values(v_actor->>'id',p_request_id,v_tournament.id,v_payload,v_result);
  return v_result;
end $$;

revoke all on function public.club_close_tournament(uuid,text,jsonb) from public,anon;
grant execute on function public.club_close_tournament(uuid,text,jsonb) to authenticated;

drop function if exists club_private.team_battle_share(integer,integer,integer,integer);

notify pgrst,'reload schema';
commit;
