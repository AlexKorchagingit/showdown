-- Optional live ladder on the timer session. Saving blinds then reaches the
-- clock through this small row instead of rewriting the 25 KB catalog on poll.
-- `levels` is optional so older clients without the field keep working.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function public.club_save_timer_session(p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_current jsonb;v_saved jsonb;
  v_current_revision bigint:=-1;v_requested_revision bigint;v_now_ms bigint;
  v_required constant text[]:=array['v','writeId','revision','updatedAt','structureId','tournamentId','levelIndex',
    'secondsLeft','isRunning','anchorAt','levelDurations','avgStackOverride','chipleaderId','totalEntries',
    'rebuyCount','chipleaderStack'];
  v_optional constant text[]:=array['levels'];
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or not p_snapshot ?& v_required
    or p_snapshot-(v_required||v_optional)<>'{}'::jsonb then raise exception using errcode='22023',message='Invalid timer snapshot'; end if;
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
    or jsonb_typeof(p_snapshot->'chipleaderStack') not in ('number','null')
    or (p_snapshot ? 'levels' and jsonb_typeof(p_snapshot->'levels')<>'array') then
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
  if p_snapshot ? 'levels' and (
    jsonb_array_length(p_snapshot->'levels') not between 1 and 1000
    or jsonb_array_length(p_snapshot->'levels')<>jsonb_array_length(p_snapshot->'levelDurations')
    or exists(select 1 from jsonb_array_elements(p_snapshot->'levels') level
      where jsonb_typeof(level)<>'object'
        or not level ?& array['level','smallBlind','bigBlind','ante','durationMinutes']
        or level-array['level','smallBlind','bigBlind','ante','durationMinutes','isBreak','isLateRegEnd','comment']::text[]<>'{}'::jsonb
        or jsonb_typeof(level->'level')<>'number' or jsonb_typeof(level->'smallBlind')<>'number'
        or jsonb_typeof(level->'bigBlind')<>'number' or jsonb_typeof(level->'ante')<>'number'
        or jsonb_typeof(level->'durationMinutes')<>'number'
        or (level ? 'isBreak' and jsonb_typeof(level->'isBreak')<>'boolean')
        or (level ? 'isLateRegEnd' and jsonb_typeof(level->'isLateRegEnd')<>'boolean')
        or (level ? 'comment' and jsonb_typeof(level->'comment')<>'string'))
    or exists(select 1 from jsonb_array_elements(p_snapshot->'levels') level
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
        or length(coalesce(level->>'comment',''))>80)
  ) then
    raise exception using errcode='22023',message='Invalid timer levels'; end if;
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

revoke all on function public.club_save_timer_session(jsonb) from public,anon;
grant execute on function public.club_save_timer_session(jsonb) to authenticated;
commit;
