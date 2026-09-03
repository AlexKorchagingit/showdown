-- Stage 2.3h: serialize self-registration and remove ordinary direct seat writes.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.registration_requests(
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  tournament_id text not null references public.tournaments(id) on delete restrict,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,request_id)
);
alter table club_private.registration_requests enable row level security;
revoke all on club_private.registration_requests from public,anon,authenticated;

create or replace function public.club_set_registration(
  p_request_id uuid,p_tournament_id text,p_registered boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb:=public.club_current_account();
  v_tournament public.tournaments%rowtype;
  v_payload jsonb;
  v_previous record;
  v_seat public.participants%rowtype;
  v_result jsonb;
  v_occupied integer;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)='' or p_registered is null then
    raise exception using errcode='22023',message='Invalid registration request';
  end if;
  v_payload:=jsonb_build_object('tournament_id',p_tournament_id,'registered',p_registered);
  select * into v_tournament from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  select payload,result into v_previous from club_private.registration_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.payload<>v_payload then
      raise exception using errcode='22023',message='Request identifier already used';
    end if;
    return v_previous.result;
  end if;
  if v_tournament.is_closed then raise exception using errcode='55000',message='Registration is closed'; end if;
  select * into v_seat from public.participants
    where tournament_id=p_tournament_id and user_id=v_actor->>'id' for update;
  if p_registered and not found then
    select count(*) into v_occupied from public.participants where tournament_id=p_tournament_id;
    if v_occupied>=v_tournament.total_seats then
      raise exception using errcode='PT409',message='No seats available';
    end if;
    insert into public.participants(id,tournament_id,user_id,nickname,rating)
    values(p_tournament_id||':'||(v_actor->>'id'),p_tournament_id,v_actor->>'id',v_actor->>'nickname',0)
    returning * into v_seat;
  elsif not p_registered and found then
    if v_seat.place is not null then
      raise exception using errcode='55000',message='A placed player cannot unregister';
    end if;
    delete from public.participants where id=v_seat.id;
  end if;
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',p_tournament_id,
    'registered',p_registered);
  insert into club_private.registration_requests(actor_id,request_id,tournament_id,payload,result)
  values(v_actor->>'id',p_request_id,p_tournament_id,v_payload,v_result);
  return v_result;
end $$;

revoke all on function public.club_set_registration(uuid,text,boolean) from public,anon;
grant execute on function public.club_set_registration(uuid,text,boolean) to authenticated;

drop policy if exists participants_insert_authorized on public.participants;
drop policy if exists participants_delete_authorized on public.participants;
drop policy if exists participants_admin_insert on public.participants;
drop policy if exists participants_admin_delete on public.participants;
create policy participants_admin_insert on public.participants for insert to authenticated
  with check ((select public.club_current_account()->>'role') in ('admin','superadmin'));
create policy participants_admin_delete on public.participants for delete to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'));

do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='participants'
    and policyname in ('participants_insert_authorized','participants_delete_authorized')) then
    raise exception 'Ordinary direct participant write policy remains';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
