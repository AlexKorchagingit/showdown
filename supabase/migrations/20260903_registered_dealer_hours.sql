-- Stage 2.2b: registered-player dealer hours and a role-filtered finance snapshot.
-- LOCAL TESTING ONLY. Final legacy ACL/RLS cutover remains a separate migration.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table if not exists club_private.dealer_hours (
  tournament_id text not null references public.tournaments(id) on delete restrict,
  user_id text not null references public.users(id) on delete restrict,
  hours numeric(6,1) not null default 0 check (hours >= 0),
  revision bigint not null default 0 check (revision >= 0),
  logged_at timestamptz,
  primary key(tournament_id,user_id)
);
create table if not exists club_private.dealer_hour_requests (
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  tournament_id text not null,
  user_id text not null,
  delta numeric not null check (delta in (-0.5,0.5)),
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id),
  foreign key(tournament_id,user_id) references club_private.dealer_hours on delete restrict
);
alter table club_private.dealer_hours enable row level security;
alter table club_private.dealer_hour_requests enable row level security;
revoke all on club_private.dealer_hours, club_private.dealer_hour_requests from public,anon,authenticated;

-- Preserve legacy rows and use the same MAX(hours) as the old UI. Never replace
-- a newer canonical value on rerun or guess an hours timestamp from a payment date.
insert into club_private.dealer_hours(tournament_id,user_id,hours)
select tournament_id,user_id,max(dealer_hours) from public.transactions
group by tournament_id,user_id on conflict(tournament_id,user_id) do nothing;

create or replace function club_private.lock_dealer_hours(p_tournament_id text,p_user_id text)
returns club_private.dealer_hours language plpgsql security definer set search_path='' as $$
declare v_hours club_private.dealer_hours%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'showdown-dealer:' || jsonb_build_array(p_tournament_id,p_user_id)::text,0));
  insert into club_private.dealer_hours(tournament_id,user_id,hours)
  select p_tournament_id,p_user_id,coalesce(max(dealer_hours),0) from public.transactions
  where tournament_id=p_tournament_id and user_id=p_user_id
  on conflict(tournament_id,user_id) do nothing;
  select * into v_hours from club_private.dealer_hours
  where tournament_id=p_tournament_id and user_id=p_user_id for update;
  return v_hours;
end;
$$;
revoke all on function club_private.lock_dealer_hours(text,text) from public,anon,authenticated;

create or replace function public.club_adjust_dealer_hours(
  p_request_id uuid,p_tournament_id text,p_user_id text,p_delta numeric
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_previous club_private.dealer_hour_requests%rowtype;
  v_hours club_private.dealer_hours%rowtype;
  v_next numeric;
  v_user public.users%rowtype;
  v_tournament public.tournaments%rowtype;
begin
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)=''
    or p_user_id is null or btrim(p_user_id)='' or p_delta is null or p_delta not in (-0.5,0.5) then
    raise exception using errcode='22023',message='Invalid dealer hours request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'showdown-dealer-request:' || jsonb_build_array(v_actor->>'id',p_request_id)::text,0));
  select * into v_previous from club_private.dealer_hour_requests
  where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.tournament_id<>p_tournament_id or v_previous.user_id<>p_user_id or v_previous.delta<>p_delta then
      raise exception using errcode='22023',message='Request identifier already used';
    end if;
    select * into v_hours from club_private.dealer_hours
    where tournament_id=p_tournament_id and user_id=p_user_id;
    return to_jsonb(v_hours);
  end if;
  select * into v_user from public.users where id=p_user_id for key share;
  if not found then raise exception using errcode='22023',message='Unknown account'; end if;
  select * into v_tournament from public.tournaments where id=p_tournament_id for share;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;

  v_hours := club_private.lock_dealer_hours(p_tournament_id,p_user_id);
  v_next := greatest(0,v_hours.hours+p_delta);
  if v_next>99999.9 then raise exception using errcode='22023',message='Hours out of range'; end if;
  if v_next<>v_hours.hours then
    -- Same lock order as payment batches. Hours must never move the cash payment date.
    perform id from public.transactions where tournament_id=p_tournament_id and user_id=p_user_id
    order by id for update;
    update public.transactions set dealer_hours=v_next,is_dealer=(v_next>0)
    where tournament_id=p_tournament_id and user_id=p_user_id;
    insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
      target_user_email,target_user_name,target_tournament_id,target_tournament_name,details)
    values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Изменил часы дилера',
      v_user.id,v_user.email,v_user.nickname,v_tournament.id,v_tournament.title,
      jsonb_build_object('previous_hours',v_hours.hours,'next_hours',v_next,'delta',p_delta)::text);
    update club_private.dealer_hours set hours=v_next,revision=revision+1,logged_at=clock_timestamp()
    where tournament_id=p_tournament_id and user_id=p_user_id returning * into v_hours;
  end if;
  -- Remember even a clamped decrement at zero so it cannot take effect on a later replay.
  insert into club_private.dealer_hour_requests(actor_id,request_id,tournament_id,user_id,delta)
  values(v_actor->>'id',p_request_id,p_tournament_id,p_user_id,p_delta);
  return to_jsonb(v_hours);
end;
$$;

create or replace function public.club_finance_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_admin boolean;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  v_admin := v_actor->>'role' in ('admin','superadmin');
  return jsonb_build_object(
    'transactions',coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc,t.id)
      from public.transactions t where v_admin or t.user_id=v_actor->>'id'),'[]'::jsonb),
    'dealer_hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.tournament_id,h.user_id)
      from club_private.dealer_hours h where v_admin or h.user_id=v_actor->>'id'),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.club_adjust_dealer_hours(uuid,text,text,numeric),
  public.club_finance_snapshot() from public,anon;
grant execute on function public.club_adjust_dealer_hours(uuid,text,text,numeric),
  public.club_finance_snapshot() to authenticated;

-- Serialize creation with hours changes; the first charge also inherits saved hours.
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
    -- Return current state: replaying creation must not make an already paid row unpaid in UI.
    select * into v_tx from public.transactions where id = v_receipt.transaction_id;
    if not found then
      raise exception using errcode = '22023', message = 'Recorded transaction unavailable';
    end if;
    return to_jsonb(v_tx);
  end if;
  select * into v_user from public.users where id = p_user_id for key share;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown account';
  end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for share;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  -- Same addon rule as the existing UI. Do not invent a different club tariff.
  if p_type = 'addon' and not exists (
    select 1 from unnest(v_tournament.features) as f(value)
    where lower(f.value) like '%addon%' or lower(f.value) like '%аддон%'
  ) then
    raise exception using errcode = '22023', message = 'Addon unavailable';
  end if;
  select h.hours into v_hours from club_private.lock_dealer_hours(p_tournament_id,p_user_id) h;
  -- Price/status/identity/timestamps are server-owned; none are accepted from the client.
  insert into public.transactions(tournament_id,user_id,type,amount,status,comment,is_dealer,dealer_hours)
  values (p_tournament_id,p_user_id,p_type,case when p_type='ticket' then 0 else 1000 end,
    case when p_type='ticket' then 'paid' else 'unpaid' end,v_comment,v_hours>0,v_hours)
  returning * into v_tx;
  insert into club_private.finance_requests(actor_id,request_id,payload,transaction_id)
  values (v_actor->>'id',p_request_id,v_payload,v_tx.id);
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
    target_user_email,target_user_name,target_tournament_id,target_tournament_name,details)
  values (v_actor->>'id',v_actor->>'email',v_actor->>'nickname',
    case when p_type='ticket' then 'Выдал билет' else 'Создал транзакцию' end,
    v_user.id,v_user.email,v_user.nickname,v_tournament.id,v_tournament.title,
    jsonb_build_object('transaction_id',v_tx.id,'type',p_type,'amount',v_tx.amount,'comment',v_comment)::text);
  return to_jsonb(v_tx);
end;
$$;


notify pgrst, 'reload schema';
commit;
