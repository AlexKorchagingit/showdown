-- Stage 2.2a: cashier creation/payment commands. LOCAL TESTING ONLY until cutover.
-- Legacy table grants/policies remain; this migration alone does not close access.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table if not exists club_private.finance_requests (
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  payload jsonb not null,
  transaction_id text not null,
  created_at timestamptz not null default now(),
  primary key(actor_id, request_id)
);
alter table club_private.finance_requests enable row level security;
revoke all on club_private.finance_requests from public, anon, authenticated;

create or replace function club_private.require_finance_admin()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  -- Serialize against a concurrent role revocation and recheck the authoritative role.
  select role into v_role from club_private.profile_roles
  where user_id = v_actor->>'id' for share;
  if v_role is null or v_role not in ('admin','superadmin') then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  return v_actor;
end;
$$;
revoke all on function club_private.require_finance_admin() from public, anon, authenticated;

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
  select coalesce(max(dealer_hours),0) into v_hours from public.transactions
  where tournament_id = p_tournament_id and user_id = p_user_id;
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
    return next to_jsonb(v_tx);
  end loop;
end;
$$;

revoke all on function public.club_create_charge(uuid,text,text,text,text) from public, anon;
revoke all on function public.club_mark_paid(text[]) from public, anon;
grant execute on function public.club_create_charge(uuid,text,text,text,text),
  public.club_mark_paid(text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
