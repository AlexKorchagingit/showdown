-- Guest seats can hold cashier plates before they are bound to a club account.
-- Binding the seat moves those plates onto the real user. Tickets stay off revenue.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

alter table public.transactions add column if not exists guest_seat_id text;
alter table public.transactions drop constraint if exists transactions_user_id_fkey;
alter table public.transactions alter column user_id drop not null;
alter table public.transactions
  add constraint transactions_user_id_fkey
  foreign key (user_id) references public.users(id) on delete restrict;
alter table public.transactions drop constraint if exists transactions_payer_present;
alter table public.transactions add constraint transactions_payer_present check (
  (user_id is not null and guest_seat_id is null)
  or (user_id is null and guest_seat_id is not null)
);
alter table public.transactions drop constraint if exists transactions_guest_seat_shape;
alter table public.transactions add constraint transactions_guest_seat_shape check (
  guest_seat_id is null or guest_seat_id ~ '^guest-[0-9a-zа-яё-]{1,60}$'
);
create index if not exists transactions_guest_seat_idx
  on public.transactions (tournament_id, guest_seat_id)
  where guest_seat_id is not null;

create or replace function club_private.guest_seat_key(p_value text)
returns text language sql immutable set search_path='' as $$
  select case
    when btrim(coalesce(p_value,'')) ~ '^guest-[0-9a-zа-яё-]{1,60}$'
      and btrim(p_value) !~ '--'
      and right(btrim(p_value), 1) <> '-'
    then btrim(p_value)
    else null
  end;
$$;
revoke all on function club_private.guest_seat_key(text) from public,anon,authenticated;

create or replace function club_private.log_finance_action(
  p_actor jsonb, p_action text, p_tx public.transactions, p_details text
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_user public.users%rowtype;
  v_name text := '';
  v_email text;
  v_target text;
  v_title text;
begin
  select title into v_title from public.tournaments where id=p_tx.tournament_id;
  if p_tx.user_id is not null then
    select * into v_user from public.users where id=p_tx.user_id;
    v_target := v_user.id;
    v_email := v_user.email;
    v_name := coalesce(v_user.nickname,'');
  else
    select p.nickname into v_name
    from public.participants p
    where p.tournament_id=p_tx.tournament_id
      and club_private.seat_identity(p.tournament_id,p.id,p.user_id)=p_tx.guest_seat_id
    limit 1;
    v_name := coalesce(v_name, p_tx.guest_seat_id, '');
  end if;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
    target_user_email,target_user_name,target_tournament_id,target_tournament_name,details)
  values (p_actor->>'id',p_actor->>'email',p_actor->>'nickname',p_action,
    v_target,v_email,v_name,p_tx.tournament_id,v_title,p_details);
end $$;
revoke all on function club_private.log_finance_action(jsonb,text,public.transactions,text)
  from public,anon,authenticated;

create or replace function public.club_create_charge(
  p_request_id uuid, p_tournament_id text, p_user_id text, p_type text,
  p_comment text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_payload jsonb;
  v_receipt club_private.finance_requests%rowtype;
  v_tx public.transactions%rowtype;
  v_user public.users%rowtype;
  v_tournament public.tournaments%rowtype;
  v_hours numeric;
  v_comment text := btrim(coalesce(p_comment,''));
  v_guest_key text;
  v_guest_name text;
begin
  if p_request_id is null or p_user_id is null or btrim(p_user_id) = ''
    or p_tournament_id is null or btrim(p_tournament_id) = ''
    or p_type is null or p_type not in ('buy-in','rebuy','addon','ticket')
    or length(v_comment) > 1000 or (p_type <> 'ticket' and v_comment <> '') then
    raise exception using errcode = '22023', message = 'Invalid charge request';
  end if;
  v_payload := jsonb_build_object('tournament_id',p_tournament_id,'user_id',p_user_id,
    'type',p_type,'comment',v_comment);
  perform pg_advisory_xact_lock(hashtextextended(
    'showdown-finance:' || (v_actor->>'id') || ':' || p_request_id::text, 0));
  select * into v_receipt from club_private.finance_requests
  where actor_id = v_actor->>'id' and request_id = p_request_id;
  if found then
    if v_receipt.payload <> v_payload then
      raise exception using errcode = '22023', message = 'Request identifier already used';
    end if;
    select * into v_tx from public.transactions where id = v_receipt.transaction_id;
    if not found then
      raise exception using errcode = '22023', message = 'Recorded transaction unavailable';
    end if;
    return club_private.finance_transaction_json(v_tx,true);
  end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for share;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  if p_type = 'addon' and not exists (
    select 1 from unnest(v_tournament.features) as f(value)
    where lower(f.value) like '%addon%' or lower(f.value) like '%аддон%'
  ) then
    raise exception using errcode = '22023', message = 'Addon unavailable';
  end if;
  v_guest_key := club_private.guest_seat_key(p_user_id);
  if v_guest_key is not null then
    select p.nickname into v_guest_name
    from public.participants p
    where p.tournament_id = p_tournament_id
      and p.user_id is null
      and club_private.seat_identity(p.tournament_id, p.id, p.user_id) = v_guest_key
    for share;
    if not found then
      raise exception using errcode = '22023', message = 'Unknown guest seat';
    end if;
    insert into public.transactions(
      tournament_id,user_id,guest_seat_id,type,amount,status,comment,is_dealer,dealer_hours)
    values (
      p_tournament_id, null, v_guest_key, p_type,
      club_private.charge_amount(p_type,v_tournament.title,v_tournament.blind_structure,v_tournament.blind_structure_id),
      case when p_type='ticket' then 'paid' else 'unpaid' end,
      v_comment, false, 0)
    returning * into v_tx;
  else
    select * into v_user from public.users where id = p_user_id for key share;
    if not found then
      raise exception using errcode = '22023', message = 'Unknown account';
    end if;
    select h.hours into v_hours from club_private.lock_dealer_hours(p_tournament_id,p_user_id) h;
    insert into public.transactions(
      tournament_id,user_id,guest_seat_id,type,amount,status,comment,is_dealer,dealer_hours)
    values (
      p_tournament_id, p_user_id, null, p_type,
      club_private.charge_amount(p_type,v_tournament.title,v_tournament.blind_structure,v_tournament.blind_structure_id),
      case when p_type='ticket' then 'paid' else 'unpaid' end,
      v_comment, v_hours>0, v_hours)
    returning * into v_tx;
  end if;
  insert into club_private.finance_requests(actor_id,request_id,payload,transaction_id)
  values (v_actor->>'id',p_request_id,v_payload,v_tx.id);
  perform club_private.log_finance_action(
    v_actor,
    case when p_type='ticket' then 'Выдал билет' else 'Создал транзакцию' end,
    v_tx,
    jsonb_build_object('transaction_id',v_tx.id,'type',p_type,'amount',v_tx.amount,'comment',v_comment)::text);
  return club_private.finance_transaction_json(v_tx,true);
end;
$$;

create or replace function public.club_void_transaction(p_transaction_id text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_tx public.transactions%rowtype;
  v_reason text := btrim(coalesce(p_reason,''));
begin
  if p_transaction_id is null or btrim(p_transaction_id)='' or length(v_reason) not between 1 and 1000 then
    raise exception using errcode='22023',message='Transaction and cancellation reason required';
  end if;
  select * into v_tx from public.transactions where id=p_transaction_id for update;
  if not found then raise exception using errcode='22023',message='Unknown transaction'; end if;
  if exists(select 1 from club_private.transaction_voids where transaction_id=v_tx.id) then
    return club_private.finance_transaction_json(v_tx,true);
  end if;
  insert into club_private.transaction_voids(transaction_id,actor_id,reason,original_record)
  values(v_tx.id,v_actor->>'id',v_reason,to_jsonb(v_tx));
  perform club_private.log_finance_action(
    v_actor, 'Отменил финансовую запись', v_tx,
    jsonb_build_object('transaction_id',v_tx.id,'type',v_tx.type,'amount',v_tx.amount,
      'previous_status',v_tx.status,'reason',v_reason,'refund_performed',false)::text);
  return club_private.finance_transaction_json(v_tx,true);
end;
$$;

create or replace function public.club_mark_paid(p_transaction_ids text[])
returns setof jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_ids text[];
  v_count integer;
  v_tx public.transactions%rowtype;
begin
  if p_transaction_ids is null or cardinality(p_transaction_ids) > 500
    or exists(select 1 from unnest(p_transaction_ids) as i(value) where value is null or btrim(value)='') then
    raise exception using errcode = '22023', message = 'Invalid payment request';
  end if;
  select coalesce(array_agg(distinct value order by value),'{}'::text[]) into v_ids
  from unnest(p_transaction_ids) as i(value);
  perform id from public.transactions where id = any(v_ids) order by id for update;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then
    raise exception using errcode = '22023', message = 'Unknown transaction';
  end if;
  if exists(select 1 from club_private.transaction_voids where transaction_id=any(v_ids)) then
    raise exception using errcode='22023',message='Cancelled transaction cannot be paid';
  end if;
  for v_tx in select * from public.transactions where id = any(v_ids) order by id loop
    if v_tx.status <> 'paid' then
      update public.transactions set status='paid',updated_at=clock_timestamp()
      where id=v_tx.id returning * into v_tx;
      perform club_private.log_finance_action(
        v_actor, 'Погасил долг', v_tx,
        jsonb_build_object('transaction_id',v_tx.id,'amount',v_tx.amount)::text);
    end if;
    return next club_private.finance_transaction_json(v_tx,true);
  end loop;
end;
$$;

create or replace function public.club_comp_charges(p_transaction_ids text[])
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_ids text[];
  v_count integer;
  v_tx public.transactions%rowtype;
begin
  if p_transaction_ids is null or cardinality(p_transaction_ids)=0 or cardinality(p_transaction_ids)>500
    or exists(select 1 from unnest(p_transaction_ids) as i(value) where value is null or btrim(value)='') then
    raise exception using errcode='22023', message='Invalid ticket request';
  end if;
  select coalesce(array_agg(distinct btrim(value) order by btrim(value)),'{}'::text[]) into v_ids
  from unnest(p_transaction_ids) as i(value);
  perform id from public.transactions where id = any(v_ids) order by id for update;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then
    raise exception using errcode='22023', message='Unknown transaction';
  end if;
  if exists(select 1 from club_private.transaction_voids where transaction_id=any(v_ids)) then
    raise exception using errcode='22023', message='Cancelled transaction cannot be a ticket';
  end if;
  if exists(
    select 1 from public.transactions
    where id = any(v_ids)
      and (
        type not in ('buy-in','rebuy','addon')
        or (status='paid' and amount<>0)
      )
  ) then
    raise exception using errcode='22023', message='Only an unpaid entry, rebuy or addon can be a ticket';
  end if;
  for v_tx in select * from public.transactions where id = any(v_ids) order by id loop
    if v_tx.amount <> 0 or v_tx.status <> 'paid' then
      update public.transactions
      set amount=0, status='paid', updated_at=clock_timestamp()
      where id=v_tx.id
      returning * into v_tx;
      perform club_private.log_finance_action(
        v_actor, 'Зафиксировал билет', v_tx,
        jsonb_build_object('transaction_id', v_tx.id, 'type', v_tx.type)::text);
    end if;
    return next club_private.finance_transaction_json(v_tx, true);
  end loop;
end $$;

create or replace function public.club_replace_participants(p_request_id uuid,p_tournament_id text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account(); v_role text; v_t public.tournaments%rowtype;
  v_payload jsonb; v_old record; v_result jsonb; v record; v_rating integer; v_rubies integer;
  v_team_battle boolean; v_players integer; v_adj record; v_old_share integer; v_new_share integer;
  v_old_ko integer; v_new_ko integer; v_old_src jsonb; v_new_src jsonb;
  v_guest_key text;
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
revoke all on function public.club_create_charge(uuid,text,text,text,text) from public,anon;
grant execute on function public.club_create_charge(uuid,text,text,text,text) to authenticated;
revoke all on function public.club_void_transaction(text,text) from public,anon;
grant execute on function public.club_void_transaction(text,text) to authenticated;
revoke all on function public.club_mark_paid(text[]) from public,anon;
grant execute on function public.club_mark_paid(text[]) to authenticated;
revoke all on function public.club_comp_charges(text[]) from public,anon;
grant execute on function public.club_comp_charges(text[]) to authenticated;

notify pgrst, 'reload schema';
commit;
