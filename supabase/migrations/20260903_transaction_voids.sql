-- Stage 2.2c: non-destructive cashier cancellation. LOCAL TESTING ONLY.
-- A void corrects the active ledger; it does NOT perform or record a cash refund.
-- Final legacy table ACL/RLS cutover remains outstanding.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.transaction_voids (
  transaction_id text primary key references public.transactions(id) on delete restrict,
  actor_id text not null references public.users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  voided_at timestamptz not null default clock_timestamp(),
  original_record jsonb not null
);
alter table club_private.transaction_voids enable row level security;
revoke all on club_private.transaction_voids from public,anon,authenticated;

create or replace function club_private.finance_transaction_json(p_tx public.transactions,p_admin boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(p_tx) || coalesce((
    select jsonb_build_object('voided_at',v.voided_at,'void_reason',case when p_admin then v.reason else null end)
    from club_private.transaction_voids v where v.transaction_id=(p_tx).id
  ),jsonb_build_object('voided_at',null,'void_reason',null));
$$;
revoke all on function club_private.finance_transaction_json(public.transactions,boolean) from public,anon,authenticated;

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
  -- Same row lock as payment: either payment precedes void, or payment is rejected.
  select * into v_tx from public.transactions where id=p_transaction_id for update;
  if not found then raise exception using errcode='22023',message='Unknown transaction'; end if;
  if exists(select 1 from club_private.transaction_voids where transaction_id=v_tx.id) then
    -- A retry never changes the original actor, reason or date, even with a different reason.
    return club_private.finance_transaction_json(v_tx,true);
  end if;
  insert into club_private.transaction_voids(transaction_id,actor_id,reason,original_record)
  values(v_tx.id,v_actor->>'id',v_reason,to_jsonb(v_tx));
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
    target_user_email,target_user_name,target_tournament_id,target_tournament_name,details)
  select v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Отменил финансовую запись',
    u.id,u.email,u.nickname,t.id,t.title,
    jsonb_build_object('transaction_id',v_tx.id,'type',v_tx.type,'amount',v_tx.amount,
      'previous_status',v_tx.status,'reason',v_reason,'refund_performed',false)::text
  from public.users u cross join public.tournaments t
  where u.id=v_tx.user_id and t.id=v_tx.tournament_id;
  return club_private.finance_transaction_json(v_tx,true);
end;
$$;
revoke all on function public.club_void_transaction(text,text) from public,anon;
grant execute on function public.club_void_transaction(text,text) to authenticated;

create or replace function public.club_finance_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_admin boolean;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  v_admin := v_actor->>'role' in ('admin','superadmin');
  return jsonb_build_object(
    'transactions',coalesce((select jsonb_agg(club_private.finance_transaction_json(t,v_admin) order by t.date desc,t.id)
      from public.transactions t where v_admin or t.user_id=v_actor->>'id'),'[]'::jsonb),
    'dealer_hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.tournament_id,h.user_id)
      from club_private.dealer_hours h where v_admin or h.user_id=v_actor->>'id'),'[]'::jsonb)
  );
end;
$$;

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
    return club_private.finance_transaction_json(v_tx,true);
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
  -- Lock every row in stable order, then validate the complete batch before any write.
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
      insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
        target_user_email,target_user_name,target_tournament_id,target_tournament_name,details)
      select v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Погасил долг',u.id,
        u.email,u.nickname,t.id,t.title,
        jsonb_build_object('transaction_id',v_tx.id,'amount',v_tx.amount)::text
      from public.users u cross join public.tournaments t
      where u.id=v_tx.user_id and t.id=v_tx.tournament_id;
    end if;
    return next club_private.finance_transaction_json(v_tx,true);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
