-- Explicit admin deletion of a tournament from the lobby.
-- Payments and finishing places go with the event. Ruby wallets stay as they are.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid='club_private.tournament_write_requests'::regclass
      and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%action%'
  loop
    execute format('alter table club_private.tournament_write_requests drop constraint %I', r.conname);
  end loop;
end $$;
alter table club_private.tournament_write_requests
  add constraint tournament_write_requests_action_check check(action in ('create','update','delete'));

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid='club_private.tournament_write_requests'::regclass
      and c.contype='f'
      and c.confrelid='public.tournaments'::regclass
  loop
    execute format('alter table club_private.tournament_write_requests drop constraint %I', r.conname);
  end loop;
end $$;
alter table club_private.tournament_write_requests alter column tournament_id drop not null;
alter table club_private.tournament_write_requests
  add constraint tournament_write_requests_tournament_id_fkey
  foreign key (tournament_id) references public.tournaments(id) on delete set null;

create or replace function public.club_delete_tournament(p_request_id uuid, p_tournament_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb:=public.club_current_account();
  v_role text;
  v_previous record;
  v_t public.tournaments%rowtype;
  v_payload jsonb;
  v_result jsonb;
  v_payments integer:=0;
  v_participants integer:=0;
  v_rubies_awarded integer:=0;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)='' then
    raise exception using errcode='22023',message='Invalid tournament request'; end if;
  v_payload:=jsonb_build_object('tournament_id',p_tournament_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((v_actor->>'id')||':'||p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showdown-tournament-delete:'||p_tournament_id,0));
  select action,payload,result into v_previous from club_private.tournament_write_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.action<>'delete' or v_previous.payload<>v_payload then
      raise exception using errcode='22023',message='Request identifier already used';
    end if;
    return v_previous.result;
  end if;
  select * into v_t from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  select count(*) into v_payments from public.transactions where tournament_id=p_tournament_id;
  select count(*),coalesce(sum(coalesce(rubies_awarded,0)),0)
    into v_participants,v_rubies_awarded
    from public.participants where tournament_id=p_tournament_id;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_tournament_id,target_tournament_name,details)
  values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Удалил турнир',v_t.id,v_t.title,
    jsonb_build_object('was_closed',v_t.is_closed,'payments_deleted',v_payments,
      'participants_deleted',v_participants,'rubies_awarded',v_rubies_awarded,'rubies_reversed',false)::text);
  if pg_catalog.to_regclass('club_private.transaction_voids') is not null then
    delete from club_private.transaction_voids v using public.transactions t
      where v.transaction_id=t.id and t.tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.dealer_hour_requests') is not null then
    delete from club_private.dealer_hour_requests where tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.dealer_hours') is not null then
    delete from club_private.dealer_hours where tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.personnel_requests') is not null then
    delete from club_private.personnel_requests where tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.personnel_rosters') is not null then
    delete from club_private.personnel_rosters where tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.registration_requests') is not null then
    delete from club_private.registration_requests where tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.participant_requests') is not null then
    delete from club_private.participant_requests where tournament_id=p_tournament_id;
  end if;
  if pg_catalog.to_regclass('club_private.tournament_close_requests') is not null then
    delete from club_private.tournament_close_requests where tournament_id=p_tournament_id;
  end if;
  delete from public.transactions where tournament_id=p_tournament_id;
  delete from public.participants where tournament_id=p_tournament_id;
  update public.timer_sessions
    set payload=pg_catalog.jsonb_set(payload,'{tournamentId}','null'::jsonb,true)
    where id='live' and pg_catalog.jsonb_typeof(payload)='object'
      and payload->>'tournamentId'=p_tournament_id;
  -- users.ruby_balance is intentionally left unchanged.
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',p_tournament_id,'deleted',true,
    'was_closed',v_t.is_closed,'payments_deleted',v_payments,'participants_deleted',v_participants);
  insert into club_private.tournament_write_requests(actor_id,request_id,action,tournament_id,payload,result)
    values(v_actor->>'id',p_request_id,'delete',v_t.id,v_payload,v_result);
  delete from public.tournaments where id=p_tournament_id;
  return v_result;
end $$;

revoke all on function public.club_delete_tournament(uuid,text) from public,anon;
grant execute on function public.club_delete_tournament(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
