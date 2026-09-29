-- Optional `noAnte` on a blind structure. The timer hides ante; stored levels
-- still keep ante = big blind so older clients keep a valid ladder.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

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
    or s-array['id','name','levels','levelDuration','guarantee','payouts','noAnte']::text[]<>'{}'::jsonb
    or jsonb_typeof(s->'id')<>'string' or jsonb_typeof(s->'name')<>'string'
    or jsonb_typeof(s->'levels')<>'array' or jsonb_typeof(s->'levelDuration')<>'number'
    or jsonb_typeof(s->'guarantee')<>'number' or jsonb_typeof(s->'payouts')<>'array'
    or (s ? 'noAnte' and jsonb_typeof(s->'noAnte')<>'boolean')) then
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
notify pgrst,'reload schema';
commit;
