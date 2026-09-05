-- Stage 2.3e: close a tournament, settle results and credit rubies atomically.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.tournament_close_requests(
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  tournament_id text not null references public.tournaments(id) on delete restrict,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,request_id)
);
alter table club_private.tournament_close_requests enable row level security;
revoke all on club_private.tournament_close_requests from public,anon,authenticated;

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
    when 8 then array[0.29,0.18,0.13,0.10,0.08,0.07,0.07,0.08]::numeric[]
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

create or replace function club_private.tournament_rubies(
  p_place integer,p_players integer,p_knockouts integer,p_bounty boolean
) returns integer language plpgsql immutable set search_path='' as $$
declare v_base integer;
begin
  if p_place<1 or p_players<1 then return 0; end if;
  v_base:=case when p_place=1 then 1000+p_players*20
    when p_place=2 then 700+p_players*15
    when p_place=3 then 500+p_players*10
    when p_place<=9 then 300+p_players*5
    else 150+p_players*2 end;
  if not p_bounty then return v_base; end if;
  return round(v_base*0.75)::integer+p_knockouts*100;
end $$;

revoke all on function club_private.tournament_place_points(integer,integer,integer) from public,anon,authenticated;
revoke all on function club_private.tournament_rubies(integer,integer,integer,boolean) from public,anon,authenticated;

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

  -- Lock recipient wallets in a stable order before any credit is written.
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
notify pgrst,'reload schema';
commit;
