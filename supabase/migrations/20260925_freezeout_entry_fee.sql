-- Freezeout cash tariff is 1200 ₽. Do not apply on production until approved.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function club_private.is_freezeout(p_title text, p_structure text, p_structure_id text)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(p_title,'') ~* 'freeze[[:space:]-]?out|фриз{1,2}[[:space:]-]?аут'
      or coalesce(p_structure,'') ~* 'freeze[[:space:]-]?out|фриз{1,2}[[:space:]-]?аут'
      or coalesce(p_structure_id,'') ~* 'freezeout';
$$;

create or replace function club_private.charge_amount(
  p_type text, p_title text, p_structure text, p_structure_id text
) returns integer language sql immutable set search_path='' as $$
  select case
    when p_type = 'ticket' then 0
    when club_private.is_freezeout(p_title, p_structure, p_structure_id) then 1200
    else 1000
  end;
$$;

revoke all on function club_private.is_freezeout(text,text,text) from public,anon,authenticated;
revoke all on function club_private.charge_amount(text,text,text,text) from public,anon,authenticated;

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
  if p_type = 'addon' and not exists (
    select 1 from unnest(v_tournament.features) as f(value)
    where lower(f.value) like '%addon%' or lower(f.value) like '%аддон%'
  ) then
    raise exception using errcode = '22023', message = 'Addon unavailable';
  end if;
  select h.hours into v_hours from club_private.lock_dealer_hours(p_tournament_id,p_user_id) h;
  insert into public.transactions(tournament_id,user_id,type,amount,status,comment,is_dealer,dealer_hours)
  values (
    p_tournament_id,p_user_id,p_type,
    club_private.charge_amount(p_type,v_tournament.title,v_tournament.blind_structure,v_tournament.blind_structure_id),
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

-- Closed freezeout buy-ins were written at the old 1000 tariff.
update public.transactions t
set amount = 1200
from public.tournaments tr
where t.tournament_id = tr.id
  and t.type = 'buy-in'
  and t.amount = 1000
  and tr.is_closed = true
  and club_private.is_freezeout(tr.title, tr.blind_structure, tr.blind_structure_id);

notify pgrst, 'reload schema';
commit;
