-- Per-seat roster revisions, lighter tournament list counts, and a month-sized cashier read.
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';

alter table public.participants add column if not exists roster_revision integer not null default 1;

create or replace function public.club_tournament_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id';
  select coalesce(jsonb_agg((to_jsonb(t)-array['staff','dealers','admin_secret_comment'])
      || jsonb_build_object(
        'staff','[]'::jsonb,
        'dealers','[]'::jsonb,
        'admin_secret_comment', case when v_role in ('admin','superadmin') then to_jsonb(t.admin_secret_comment) else 'null'::jsonb end,
        'occupied_count', (
          select count(*)::int from public.participants p
          where p.tournament_id=t.id and (p.user_id is not null or p.id like '%:guest-%')
        ),
        'arrived_count', (
          select count(*)::int from public.participants p
          where p.tournament_id=t.id and p.arrived and (p.user_id is not null or p.id like '%:guest-%')
        )
      )
      order by t.start_date desc,t.start_time desc,t.id),'[]'::jsonb)
    into v_result from public.tournaments t
    where v_role in ('admin','superadmin') or t.hidden is not true;
  return v_result;
end $$;

drop function if exists public.club_finance_snapshot();
create or replace function public.club_finance_snapshot(p_scope text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_admin boolean;
  v_from timestamptz;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if p_scope is null or p_scope not in ('all','month') then
    raise exception using errcode='22023',message='Invalid finance scope';
  end if;
  v_admin := v_actor->>'role' in ('admin','superadmin');
  v_from := date_trunc('month', clock_timestamp() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';
  return jsonb_build_object(
    'transactions',coalesce((select jsonb_agg(club_private.finance_transaction_json(t,v_admin) order by t.date desc,t.id)
      from public.transactions t
      where (v_admin or t.user_id=v_actor->>'id')
        and (
          p_scope='all'
          or t.status='unpaid'
          or t.date>=v_from
          or exists (
            select 1 from club_private.transaction_voids v
            where v.transaction_id=t.id and v.voided_at>=v_from
          )
        )), '[]'::jsonb),
    'dealer_hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.tournament_id,h.user_id)
      from club_private.dealer_hours h where v_admin or h.user_id=v_actor->>'id'),'[]'::jsonb)
  );
end $$;

create or replace function public.club_replace_participants(p_request_id uuid,p_tournament_id text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account(); v_role text; v_t public.tournaments%rowtype;
  v_payload jsonb; v_old record; v_result jsonb; v record; v_rating integer; v_rubies integer;
  v_team_battle boolean; v_players integer; v_adj record; v_old_share integer; v_new_share integer;
  v_old_ko integer; v_new_ko integer; v_old_src jsonb; v_new_src jsonb;
  v_guest_key text; v_stale integer := 0;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)='' or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows)>500 then raise exception using errcode='22023',message='Invalid participant request'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x)<>'object'
    or not x ?& array['seat_id','source_id','user_id','nickname','place','knockouts','comment','arrived']
    or x-array['seat_id','source_id','user_id','nickname','place','knockouts','comment','arrived','team_partner_id','seen_revision']::text[]<>'{}'::jsonb
    or jsonb_typeof(x->'seat_id')<>'string' or jsonb_typeof(x->'nickname')<>'string'
    or jsonb_typeof(x->'knockouts')<>'number'
    or jsonb_typeof(x->'source_id') not in ('string','null') or jsonb_typeof(x->'user_id') not in ('string','null')
    or jsonb_typeof(x->'place') not in ('number','null') or jsonb_typeof(x->'comment') not in ('string','null')
    or jsonb_typeof(x->'arrived')<>'boolean'
    or (x ? 'team_partner_id' and jsonb_typeof(x->'team_partner_id') not in ('string','null'))
    or (x ? 'seen_revision' and jsonb_typeof(x->'seen_revision') not in ('number','null'))) then
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
    place integer,knockouts integer,comment text,arrived boolean,team_partner_id text,partner_specified boolean not null,seen_revision integer) on commit drop;
  insert into desired_participants
  select nullif(x->>'source_id',''),x->>'seat_id',nullif(x->>'user_id',''),btrim(x->>'nickname'),
    case when jsonb_typeof(x->'place')='number' then (x->>'place')::integer end,
    (x->>'knockouts')::integer,
    case when jsonb_typeof(x->'comment')='string' then x->>'comment' end,
    (x->>'arrived')::boolean,
    case when x ? 'team_partner_id' then nullif(btrim(coalesce(x->>'team_partner_id','')),'') end,
    x ? 'team_partner_id',
    case when jsonb_typeof(x->'seen_revision')='number' then (x->>'seen_revision')::integer end
  from jsonb_array_elements(p_rows) x;
  update desired_participants d
  set place=p.place, knockouts=p.knockouts, comment=p.comment, arrived=p.arrived,
      team_partner_id=p.team_partner_id, nickname=case when d.user_id is null then p.nickname else d.nickname end
  from public.participants p
  where d.source_id=p.id and d.seen_revision is not null and d.seen_revision<>coalesce(p.roster_revision,0);
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
  select count(*) into v_stale from desired_participants d
  join public.participants p on p.id=d.source_id
  where d.seen_revision is not null and d.seen_revision<>coalesce(p.roster_revision,0);
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
        team_partner_id=nullif(btrim(coalesce(v.team_partner_id,'')),''),
        roster_revision=case
          when place is distinct from v.place
            or knockouts is distinct from case when v_t.is_bounty then v.knockouts else 0 end
            or arrived is distinct from v.arrived
            or coalesce(comment,'') is distinct from coalesce(nullif(btrim(coalesce(v.comment,'')),''),'')
            or coalesce(team_partner_id,'') is distinct from coalesce(nullif(btrim(coalesce(v.team_partner_id,'')),''),'')
            or nickname is distinct from v.nickname
            or user_id is distinct from v.user_id
          then coalesce(roster_revision,0)+1
          else coalesce(roster_revision,0)
        end
        where id=v.source_id;
      if v.user_id is not null then
        v_guest_key := substring(v.source_id from length(p_tournament_id)+2);
        if v_guest_key like 'guest-%' and v_guest_key <> v.user_id then
          update public.transactions
          set user_id=v.user_id, guest_seat_id=null, updated_at=clock_timestamp()
          where tournament_id=p_tournament_id and user_id is null and guest_seat_id=v_guest_key;
        end if;
      end if;
    else
      v_rating:=case when v_t.results_entered and not v_team_battle then
        club_private.tournament_place_points(coalesce(v.place,0),greatest(1,(select count(*)::integer from desired_participants)),v_t.guarantee)
        +case when v_t.is_bounty then v.knockouts*100 else 0 end else 0 end;
      insert into public.participants(id,tournament_id,user_id,nickname,rating,place,knockouts,rubies_awarded,comment,arrived,team_partner_id,roster_revision)
      values(v.seat_id,p_tournament_id,v.user_id,v.nickname,v_rating,v.place,
        case when v_t.is_bounty then v.knockouts else 0 end,case when v_t.rubies_distributed then 0 else null end,
        nullif(btrim(coalesce(v.comment,'')),''),v.arrived,nullif(btrim(coalesce(v.team_partner_id,'')),''),1);
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
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',p_tournament_id,'participants',(select count(*) from desired_participants),'stale_seats',v_stale);
  insert into club_private.participant_requests values(v_actor->>'id',p_request_id,p_tournament_id,v_payload,v_result,clock_timestamp());
  return v_result;
end $$;


revoke all on function public.club_replace_participants(uuid,text,jsonb) from public,anon;
grant execute on function public.club_replace_participants(uuid,text,jsonb) to authenticated;
revoke all on function public.club_tournament_snapshot() from public,anon;
grant execute on function public.club_tournament_snapshot() to authenticated;
revoke all on function public.club_finance_snapshot(text) from public,anon;
grant execute on function public.club_finance_snapshot(text) to authenticated;
notify pgrst, 'reload schema';
commit;
