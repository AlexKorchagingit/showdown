-- Stage 2.3k: protected audit projection and server-authoritative live timer writes.
-- Legacy timer rows in logs are preserved but no longer used by the client.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists public.timer_sessions(
  id text primary key default 'live',payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now());
insert into public.timer_sessions(id,payload) values('live','{}'::jsonb) on conflict(id) do nothing;
drop trigger if exists timer_sessions_set_updated_at on public.timer_sessions;
create trigger timer_sessions_set_updated_at before update on public.timer_sessions
  for each row execute procedure public.set_updated_at();
alter table public.timer_sessions enable row level security;

create or replace function public.club_audit_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='SuperAdmin required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id';
  if v_role<>'superadmin' then raise exception using errcode='42501',message='SuperAdmin required'; end if;
  select coalesce(jsonb_agg(to_jsonb(entry) order by entry.timestamp desc,entry.id),'[]'::jsonb) into v_result
  from public.logs entry where entry.id<>'blinds-timer-session' and entry.action_type<>'__timer_session__';
  return v_result;
end $$;

create or replace function public.club_save_timer_session(p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_current jsonb;v_saved jsonb;
  v_current_revision bigint:=-1;v_requested_revision bigint;v_now_ms bigint;
  v_allowed constant text[]:=array['v','writeId','revision','updatedAt','structureId','tournamentId','levelIndex',
    'secondsLeft','isRunning','anchorAt','levelDurations','avgStackOverride','chipleaderId','totalEntries',
    'rebuyCount','chipleaderStack'];
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or not p_snapshot ?& v_allowed
    or p_snapshot-v_allowed<>'{}'::jsonb then raise exception using errcode='22023',message='Invalid timer snapshot'; end if;
  if jsonb_typeof(p_snapshot->'v')<>'number' or jsonb_typeof(p_snapshot->'writeId')<>'string'
    or jsonb_typeof(p_snapshot->'revision')<>'number' or jsonb_typeof(p_snapshot->'updatedAt')<>'number'
    or jsonb_typeof(p_snapshot->'structureId') not in ('string','null')
    or jsonb_typeof(p_snapshot->'tournamentId') not in ('string','null')
    or jsonb_typeof(p_snapshot->'levelIndex')<>'number' or jsonb_typeof(p_snapshot->'secondsLeft')<>'number'
    or jsonb_typeof(p_snapshot->'isRunning')<>'boolean' or jsonb_typeof(p_snapshot->'anchorAt')<>'string'
    or jsonb_typeof(p_snapshot->'levelDurations')<>'array'
    or jsonb_typeof(p_snapshot->'avgStackOverride') not in ('number','null')
    or jsonb_typeof(p_snapshot->'chipleaderId') not in ('string','null')
    or jsonb_typeof(p_snapshot->'totalEntries') not in ('number','null')
    or jsonb_typeof(p_snapshot->'rebuyCount') not in ('number','null')
    or jsonb_typeof(p_snapshot->'chipleaderStack') not in ('number','null') then
    raise exception using errcode='22023',message='Invalid timer field types'; end if;
  if (p_snapshot->>'v')::numeric<>1 or length(p_snapshot->>'writeId') not between 1 and 200
    or (p_snapshot->>'revision')::numeric<>trunc((p_snapshot->>'revision')::numeric)
    or (p_snapshot->>'revision')::numeric not between 0 and 2147483647
    or (p_snapshot->>'updatedAt')::numeric<0
    or length(coalesce(p_snapshot->>'structureId',''))>500
    or length(coalesce(p_snapshot->>'tournamentId',''))>500
    or length(coalesce(p_snapshot->>'chipleaderId',''))>500
    or (p_snapshot->>'levelIndex')::numeric<>trunc((p_snapshot->>'levelIndex')::numeric)
    or (p_snapshot->>'levelIndex')::numeric not between 0 and 999
    or (p_snapshot->>'secondsLeft')::numeric not between 0 and 604800
    or length(p_snapshot->>'anchorAt')>100 or (p_snapshot->>'anchorAt')::timestamptz is null
    or jsonb_array_length(p_snapshot->'levelDurations') not between 1 and 1000
    or (p_snapshot->>'levelIndex')::integer>=jsonb_array_length(p_snapshot->'levelDurations')
    or exists(select 1 from jsonb_array_elements(p_snapshot->'levelDurations') x
      where jsonb_typeof(x)<>'number' or (x#>>'{}')::numeric<>trunc((x#>>'{}')::numeric)
        or (x#>>'{}')::numeric not between 1 and 86400)
    or (jsonb_typeof(p_snapshot->'avgStackOverride')='number'
      and (p_snapshot->>'avgStackOverride')::numeric not between 0 and 2147483647)
    or (jsonb_typeof(p_snapshot->'totalEntries')='number' and ((p_snapshot->>'totalEntries')::numeric<>trunc((p_snapshot->>'totalEntries')::numeric)
      or (p_snapshot->>'totalEntries')::numeric not between 0 and 1000000))
    or (jsonb_typeof(p_snapshot->'rebuyCount')='number' and ((p_snapshot->>'rebuyCount')::numeric<>trunc((p_snapshot->>'rebuyCount')::numeric)
      or (p_snapshot->>'rebuyCount')::numeric not between 0 and 1000000))
    or (jsonb_typeof(p_snapshot->'chipleaderStack')='number'
      and (p_snapshot->>'chipleaderStack')::numeric not between 0 and 2147483647) then
    raise exception using errcode='22023',message='Invalid timer values'; end if;
  if jsonb_typeof(p_snapshot->'tournamentId')='string' and not exists(
    select 1 from public.tournaments where id=p_snapshot->>'tournamentId') then
    raise exception using errcode='22023',message='Unknown timer tournament'; end if;
  select payload into v_current from public.timer_sessions where id='live' for update;
  if v_current is null then
    insert into public.timer_sessions(id,payload) values('live','{}'::jsonb)
      on conflict(id) do update set id=excluded.id returning payload into v_current;
  end if;
  if jsonb_typeof(v_current)='object' and jsonb_typeof(v_current->'revision')='number'
    and (v_current->>'revision')::numeric=trunc((v_current->>'revision')::numeric) then
    v_current_revision:=(v_current->>'revision')::bigint;
  end if;
  if v_current->>'writeId'=p_snapshot->>'writeId' then
    if v_current-array['revision','updatedAt','anchorAt']<>p_snapshot-array['revision','updatedAt','anchorAt'] then
      raise exception using errcode='22023',message='Timer write identifier already used'; end if;
    return v_current;
  end if;
  v_requested_revision:=(p_snapshot->>'revision')::bigint;
  if v_current_revision>=0 and v_requested_revision<v_current_revision then return v_current; end if;
  v_now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  v_saved:=p_snapshot||jsonb_build_object('revision',greatest(v_requested_revision,v_current_revision+1),
    'updatedAt',v_now_ms,'anchorAt',clock_timestamp());
  update public.timer_sessions set payload=v_saved where id='live';
  return v_saved;
end $$;

revoke all on function public.club_audit_snapshot() from public,anon;
revoke all on function public.club_save_timer_session(jsonb) from public,anon;
grant execute on function public.club_audit_snapshot() to authenticated;
grant execute on function public.club_save_timer_session(jsonb) to authenticated;

drop policy if exists logs_superadmin_read on public.logs;
drop policy if exists logs_admin_insert on public.logs;
revoke select,insert,update,delete on public.logs from public,anon,authenticated;

drop policy if exists timer_admin_read on public.timer_sessions;
drop policy if exists timer_admin_insert on public.timer_sessions;
drop policy if exists timer_admin_update on public.timer_sessions;
drop policy if exists timer_authenticated_read on public.timer_sessions;
create policy timer_admin_read on public.timer_sessions for select to authenticated
  using ((select public.club_current_account()->>'role') in ('admin','superadmin'));
revoke insert,update,delete on public.timer_sessions from public,anon,authenticated;
grant select on public.timer_sessions to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.timer_sessions;
exception when duplicate_object then null;when undefined_object then null;end $$;
notify pgrst,'reload schema';
commit;
