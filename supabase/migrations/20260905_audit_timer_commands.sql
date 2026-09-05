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
do $$
declare v_snapshot jsonb;
begin
  select details::jsonb into v_snapshot from public.logs where id='blinds-structures';
  insert into public.timer_sessions(id,payload)
    values('blind-structures',coalesce(v_snapshot,'{}'::jsonb))
    on conflict(id) do update set payload=excluded.payload
      where public.timer_sessions.payload='{}'::jsonb and excluded.payload<>'{}'::jsonb;
exception when invalid_text_representation then
  raise exception using errcode='22023',message='Invalid legacy blind structures snapshot';
end $$;
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
  from public.logs entry where entry.id not in ('blinds-timer-session','blinds-structures','participant-arrivals')
    and entry.action_type not in ('__timer_session__','__blind_structures__','__participant_arrivals__');
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

create or replace function club_private.validate_blind_structures_snapshot(p_snapshot jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare v_allowed constant text[]:=array['v','writeId','revision','updatedAt','structures','migrations'];
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'
    or not p_snapshot ?& array['v','writeId','revision','updatedAt','structures']
    or p_snapshot-v_allowed<>'{}'::jsonb then
    raise exception using errcode='22023',message='Invalid blind structures snapshot';
  end if;
  if jsonb_typeof(p_snapshot->'v')<>'number' or jsonb_typeof(p_snapshot->'writeId')<>'string'
    or jsonb_typeof(p_snapshot->'revision')<>'number' or jsonb_typeof(p_snapshot->'updatedAt')<>'number'
    or jsonb_typeof(p_snapshot->'structures')<>'array'
    or (p_snapshot ? 'migrations' and jsonb_typeof(p_snapshot->'migrations')<>'array') then
    raise exception using errcode='22023',message='Invalid blind structures field types';
  end if;
  if (p_snapshot->>'v')::numeric<>1 or length(p_snapshot->>'writeId') not between 1 and 200
    or (p_snapshot->>'revision')::numeric<>trunc((p_snapshot->>'revision')::numeric)
    or (p_snapshot->>'revision')::numeric not between 0 and 2147483647
    or (p_snapshot->>'updatedAt')::numeric not between 0 and 9007199254740991
    or jsonb_array_length(p_snapshot->'structures') not between 1 and 100
    or (p_snapshot ? 'migrations' and jsonb_array_length(p_snapshot->'migrations')>100) then
    raise exception using errcode='22023',message='Invalid blind structures values';
  end if;
  if p_snapshot ? 'migrations' and exists(select 1 from jsonb_array_elements(p_snapshot->'migrations') m
    where jsonb_typeof(m)<>'string' or length(m#>>'{}') not between 1 and 200) then
    raise exception using errcode='22023',message='Invalid blind structures migrations';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'structures') s where jsonb_typeof(s)<>'object'
    or not s ?& array['id','name','levels','levelDuration','guarantee','payouts']
    or s-array['id','name','levels','levelDuration','guarantee','payouts']::text[]<>'{}'::jsonb
    or jsonb_typeof(s->'id')<>'string' or jsonb_typeof(s->'name')<>'string'
    or jsonb_typeof(s->'levels')<>'array' or jsonb_typeof(s->'levelDuration')<>'number'
    or jsonb_typeof(s->'guarantee')<>'number' or jsonb_typeof(s->'payouts')<>'array') then
    raise exception using errcode='22023',message='Invalid blind structure';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'structures') s
    where length(s->>'id') not between 1 and 200 or length(s->>'name') not between 1 and 200
      or (s->>'levelDuration')::numeric<>trunc((s->>'levelDuration')::numeric)
      or (s->>'levelDuration')::numeric not between 1 and 1440
      or (s->>'guarantee')::numeric<>trunc((s->>'guarantee')::numeric)
      or (s->>'guarantee')::numeric not between 0 and 2147483647
      or jsonb_array_length(s->'levels') not between 1 and 1000
      or jsonb_array_length(s->'payouts')>500)
    or (select count(*) from jsonb_array_elements(p_snapshot->'structures'))<>(select count(distinct s->>'id')
      from jsonb_array_elements(p_snapshot->'structures') s) then
    raise exception using errcode='22023',message='Invalid blind structure values';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'structures') s,
      lateral jsonb_array_elements(s->'levels') level where jsonb_typeof(level)<>'object'
      or not level ?& array['level','smallBlind','bigBlind','ante','durationMinutes']
      or level-array['level','smallBlind','bigBlind','ante','durationMinutes','isBreak','isLateRegEnd','comment']::text[]<>'{}'::jsonb
      or jsonb_typeof(level->'level')<>'number' or jsonb_typeof(level->'smallBlind')<>'number'
      or jsonb_typeof(level->'bigBlind')<>'number' or jsonb_typeof(level->'ante')<>'number'
      or jsonb_typeof(level->'durationMinutes')<>'number'
      or (level ? 'isBreak' and jsonb_typeof(level->'isBreak')<>'boolean')
      or (level ? 'isLateRegEnd' and jsonb_typeof(level->'isLateRegEnd')<>'boolean')
      or (level ? 'comment' and jsonb_typeof(level->'comment')<>'string')) then
    raise exception using errcode='22023',message='Invalid blind level';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'structures') s,
      lateral jsonb_array_elements(s->'levels') level
    where (level->>'level')::numeric<>trunc((level->>'level')::numeric)
      or (level->>'level')::numeric not between 0 and 10000
      or (level->>'smallBlind')::numeric<>trunc((level->>'smallBlind')::numeric)
      or (level->>'smallBlind')::numeric not between 0 and 2147483647
      or (level->>'bigBlind')::numeric<>trunc((level->>'bigBlind')::numeric)
      or (level->>'bigBlind')::numeric not between 0 and 2147483647
      or (level->>'ante')::numeric<>trunc((level->>'ante')::numeric)
      or (level->>'ante')::numeric not between 0 and 2147483647
      or (level->>'durationMinutes')::numeric<>trunc((level->>'durationMinutes')::numeric)
      or (level->>'durationMinutes')::numeric not between 1 and 1440
      or length(coalesce(level->>'comment',''))>80) then
    raise exception using errcode='22023',message='Invalid blind level values';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'structures') s,
      lateral jsonb_array_elements(s->'payouts') payout where jsonb_typeof(payout)<>'object'
      or not payout ?& array['place','share'] or payout-array['place','share']::text[]<>'{}'::jsonb
      or jsonb_typeof(payout->'place')<>'number' or jsonb_typeof(payout->'share')<>'number') then
    raise exception using errcode='22023',message='Invalid blind payout';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'structures') s,
      lateral jsonb_array_elements(s->'payouts') payout
    where (payout->>'place')::numeric<>trunc((payout->>'place')::numeric)
      or (payout->>'place')::numeric not between 1 and 500
      or (payout->>'share')::numeric not between 0 and 100) then
    raise exception using errcode='22023',message='Invalid blind payout values';
  end if;
end $$;
revoke all on function club_private.validate_blind_structures_snapshot(jsonb) from public,anon,authenticated;

create or replace function public.club_blind_structures_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id';
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  select payload into v_result from public.timer_sessions where id='blind-structures';
  return coalesce(v_result,'{}'::jsonb);
end $$;

create or replace function public.club_save_blind_structures(p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_current jsonb;v_saved jsonb;
  v_current_revision bigint:=-1;v_requested_revision bigint;v_now_ms bigint;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  perform club_private.validate_blind_structures_snapshot(p_snapshot);
  select payload into v_current from public.timer_sessions where id='blind-structures' for update;
  if v_current is null then
    insert into public.timer_sessions(id,payload) values('blind-structures','{}'::jsonb)
      on conflict(id) do update set id=excluded.id returning payload into v_current;
  end if;
  if jsonb_typeof(v_current)='object' and jsonb_typeof(v_current->'revision')='number'
    and (v_current->>'revision')::numeric=trunc((v_current->>'revision')::numeric)
    and (v_current->>'revision')::numeric between 0 and 2147483647 then
    v_current_revision:=(v_current->>'revision')::bigint;
  end if;
  if v_current->>'writeId'=p_snapshot->>'writeId' then
    if v_current-array['revision','updatedAt']<>p_snapshot-array['revision','updatedAt'] then
      raise exception using errcode='22023',message='Blind structures write identifier already used'; end if;
    return v_current;
  end if;
  v_requested_revision:=(p_snapshot->>'revision')::bigint;
  if v_current_revision>=0 and v_requested_revision<v_current_revision then return v_current; end if;
  v_now_ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  v_saved:=p_snapshot||jsonb_build_object('revision',greatest(v_requested_revision,v_current_revision+1),'updatedAt',v_now_ms);
  update public.timer_sessions set payload=v_saved where id='blind-structures';
  return v_saved;
end $$;

revoke all on function public.club_audit_snapshot() from public,anon;
revoke all on function public.club_save_timer_session(jsonb) from public,anon;
revoke all on function public.club_blind_structures_snapshot() from public,anon;
revoke all on function public.club_save_blind_structures(jsonb) from public,anon;
grant execute on function public.club_audit_snapshot() to authenticated;
grant execute on function public.club_save_timer_session(jsonb) to authenticated;
grant execute on function public.club_blind_structures_snapshot() to authenticated;
grant execute on function public.club_save_blind_structures(jsonb) to authenticated;

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
