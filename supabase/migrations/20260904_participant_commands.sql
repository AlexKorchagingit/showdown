-- Stage 2.3i: server-authoritative administrative participant replacement and final participant ACL.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';

alter table public.participants add column if not exists arrived boolean not null default false;

-- Preserve lobby check-ins written by the currently deployed client before
-- `participants.arrived` existed. The legacy log row remains untouched so the
-- migration is recoverable and can be audited after cutover.
do $$
declare v_snapshot jsonb;
begin
  select details::jsonb into v_snapshot from public.logs where id='participant-arrivals';
  if jsonb_typeof(v_snapshot)='object' and v_snapshot->>'v'='1'
    and jsonb_typeof(v_snapshot->'byTournament')='object' then
    update public.participants p set arrived=true where not p.arrived and (
      coalesce(v_snapshot#>array['byTournament',p.tournament_id,p.id],'false'::jsonb)='true'::jsonb
      or (p.user_id is not null and
        coalesce(v_snapshot#>array['byTournament',p.tournament_id,p.user_id],'false'::jsonb)='true'::jsonb));
  end if;
exception when invalid_text_representation then
  raise exception using errcode='22023',message='Invalid legacy participant arrival snapshot';
end $$;

create table if not exists club_private.participant_requests(
  actor_id text not null references public.users(id) on delete restrict, request_id uuid not null,
  tournament_id text not null references public.tournaments(id) on delete restrict,
  payload jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,request_id));
alter table club_private.participant_requests enable row level security;
revoke all on club_private.participant_requests from public,anon,authenticated;

create or replace function public.club_replace_participants(p_request_id uuid,p_tournament_id text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account(); v_role text; v_t public.tournaments%rowtype;
  v_payload jsonb; v_old record; v_result jsonb; v record; v_rating integer; v_rubies integer;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)='' or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows)>500 then raise exception using errcode='22023',message='Invalid participant request'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x)<>'object'
    or not x ?& array['seat_id','source_id','user_id','nickname','place','knockouts','comment','arrived']
    or x-array['seat_id','source_id','user_id','nickname','place','knockouts','comment','arrived']::text[]<>'{}'::jsonb
    or jsonb_typeof(x->'seat_id')<>'string' or jsonb_typeof(x->'nickname')<>'string'
    or jsonb_typeof(x->'knockouts')<>'number'
    or jsonb_typeof(x->'source_id') not in ('string','null') or jsonb_typeof(x->'user_id') not in ('string','null')
    or jsonb_typeof(x->'place') not in ('number','null') or jsonb_typeof(x->'comment') not in ('string','null')
    or jsonb_typeof(x->'arrived')<>'boolean') then
    raise exception using errcode='22023',message='Invalid participant rows'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where length(x->>'seat_id') not between 3 and 500
    or (x->>'knockouts')::numeric<>trunc((x->>'knockouts')::numeric) or (x->>'knockouts')::numeric not between 0 and 10000
    or (jsonb_typeof(x->'place')='number' and ((x->>'place')::numeric<>trunc((x->>'place')::numeric)
      or (x->>'place')::numeric not between 1 and 500))
    or length(coalesce(x->>'comment',''))>1000) then raise exception using errcode='22023',message='Invalid participant values'; end if;
  select jsonb_agg(x order by x->>'seat_id') into v_payload from jsonb_array_elements(p_rows) x;
  v_payload:=jsonb_build_object('tournament_id',p_tournament_id,'rows',coalesce(v_payload,'[]'::jsonb));
  select * into v_t from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  select payload,result into v_old from club_private.participant_requests where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then if v_old.payload<>v_payload then raise exception using errcode='22023',message='Request identifier already used'; end if; return v_old.result; end if;
  perform 1 from public.participants where tournament_id=p_tournament_id order by id for update;
  create temporary table desired_participants(source_id text,seat_id text primary key,user_id text,nickname text,
    place integer,knockouts integer,comment text,arrived boolean) on commit drop;
  insert into desired_participants select nullif(x.source_id,''),x.seat_id,nullif(x.user_id,''),btrim(x.nickname),x.place,x.knockouts,x.comment,x.arrived
    from jsonb_to_recordset(p_rows) x(source_id text,seat_id text,user_id text,nickname text,place integer,knockouts integer,comment text,arrived boolean);
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
      if v_t.results_entered then v_rating:=v_rating
        -club_private.tournament_place_points(coalesce(v.old_place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        -case when v_t.is_bounty then v.old_knockouts*100 else 0 end
        +club_private.tournament_place_points(coalesce(v.place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        +case when v_t.is_bounty then v.knockouts*100 else 0 end; end if;
      v_rubies:=v.old_rubies;
      update public.participants set id=v.seat_id,user_id=v.user_id,nickname=v.nickname,rating=v_rating,
        place=v.place,knockouts=case when v_t.is_bounty then v.knockouts else 0 end,
        rubies_awarded=v_rubies,comment=nullif(btrim(coalesce(v.comment,'')),''),arrived=v.arrived where id=v.source_id;
    else
      v_rating:=case when v_t.results_entered then
        club_private.tournament_place_points(coalesce(v.place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        +case when v_t.is_bounty then v.knockouts*100 else 0 end else 0 end;
      insert into public.participants(id,tournament_id,user_id,nickname,rating,place,knockouts,rubies_awarded,comment,arrived)
      values(v.seat_id,p_tournament_id,v.user_id,v.nickname,v_rating,v.place,
        case when v_t.is_bounty then v.knockouts else 0 end,case when v_t.rubies_distributed then 0 else null end,
        nullif(btrim(coalesce(v.comment,'')),''),v.arrived);
    end if;
  end loop;
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
drop policy if exists participants_admin_insert on public.participants;
drop policy if exists participants_admin_update on public.participants;
drop policy if exists participants_admin_delete on public.participants;
revoke insert,update,delete on public.participants from public,anon,authenticated;
notify pgrst,'reload schema'; commit;
