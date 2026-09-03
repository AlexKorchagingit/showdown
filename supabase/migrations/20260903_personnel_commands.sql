-- Stage 2.2d, LOCAL ONLY. Requires auth foundation and finance commands. Legacy ACL/RLS cutover is still pending.
-- Preserve the source JSON exactly; never infer a users.id from a personnel name.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.personnel_rosters (
  tournament_id text primary key references public.tournaments(id) on delete restrict,
  revision bigint not null default 0 check (revision >= 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries)='array'),
  legacy_staff jsonb not null,
  legacy_dealers jsonb not null
);
create table if not exists club_private.personnel_requests (
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  tournament_id text not null references club_private.personnel_rosters(tournament_id) on delete restrict,
  payload jsonb not null,
  primary key(actor_id,request_id)
);
alter table club_private.personnel_rosters enable row level security;
alter table club_private.personnel_requests enable row level security;
revoke all on club_private.personnel_rosters,club_private.personnel_requests from public,anon,authenticated;

create or replace function club_private.ensure_personnel_roster(p_tournament_id text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_t public.tournaments%rowtype;
  v_entries jsonb := '[]';
  v_source jsonb;
  v_row jsonb;
  v_kind text;
  v_hours numeric;
  v_minutes numeric;
begin
  select * into v_t from public.tournaments where id=p_tournament_id for share;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  if exists(select 1 from club_private.personnel_rosters where tournament_id=p_tournament_id) then return; end if;
  foreach v_kind in array array['dealer','staff'] loop
    v_source := case when v_kind='dealer' then v_t.dealers else v_t.staff end;
    if jsonb_typeof(v_source) is distinct from 'array' then
      raise exception using errcode='22023',message='Personnel source requires review';
    end if;
    for v_row in select value from jsonb_array_elements(v_source) loop
      if jsonb_typeof(v_row) is distinct from 'object'
        or jsonb_typeof(v_row->'name') is distinct from 'string'
        or jsonb_typeof(v_row->'hours') is distinct from 'number'
        or jsonb_typeof(v_row->'minutes') is distinct from 'number'
        or (v_kind='staff' and jsonb_typeof(v_row->'role') is distinct from 'string')
        or (v_row ? 'comment' and jsonb_typeof(v_row->'comment') is distinct from 'string')
        or (v_row ? 'loggedAt' and jsonb_typeof(v_row->'loggedAt') is distinct from 'string') then
        raise exception using errcode='22023',message='Personnel source requires review';
      end if;
      v_hours := (v_row->>'hours')::numeric;
      v_minutes := (v_row->>'minutes')::numeric;
      if v_hours<0 or v_minutes<0 or trunc(v_hours)<>v_hours or trunc(v_minutes)<>v_minutes
        or v_hours*60+v_minutes>600000 then
        raise exception using errcode='22023',message='Personnel hours require review';
      end if;
      if v_row ? 'loggedAt' and not isfinite((v_row->>'loggedAt')::timestamptz) then
        raise exception using errcode='22023',message='Personnel timestamp requires review';
      end if;
      v_entries := v_entries || jsonb_build_array(jsonb_build_object(
        'id',gen_random_uuid(),'kind',v_kind,'data',v_row,'archived_at',null,'archive_reason',null));
    end loop;
  end loop;
  insert into club_private.personnel_rosters(tournament_id,entries,legacy_staff,legacy_dealers)
  values(p_tournament_id,v_entries,v_t.staff,v_t.dealers) on conflict(tournament_id) do nothing;
end;
$$;
revoke all on function club_private.ensure_personnel_roster(text) from public,anon,authenticated;

-- Fail transactionally on unfamiliar legacy shapes; never skip or rewrite source rows.
lock table public.tournaments in share mode;
do $$ declare v_id text; begin
  for v_id in select id from public.tournaments order by id loop
    perform club_private.ensure_personnel_roster(v_id);
  end loop;
end $$;

create or replace function club_private.personnel_json(p_tournament_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('tournament_id',r.tournament_id,'revision',r.revision,
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.value->'id','kind',e.value->'kind','archived_at',e.value->'archived_at',
      'archive_reason',e.value->'archive_reason','data',jsonb_strip_nulls(jsonb_build_object(
        'name',e.value->'data'->'name','role',e.value->'data'->'role',
        'hours',e.value->'data'->'hours','minutes',e.value->'data'->'minutes',
        'comment',e.value->'data'->'comment','loggedAt',e.value->'data'->'loggedAt')))
      order by e.ordinality) from jsonb_array_elements(r.entries) with ordinality e),'[]'::jsonb))
  from club_private.personnel_rosters r where r.tournament_id=p_tournament_id;
$$;
revoke all on function club_private.personnel_json(text) from public,anon,authenticated;

create or replace function public.club_personnel_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb := public.club_current_account(); begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if v_actor->>'role' not in ('admin','superadmin') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(club_private.personnel_json(tournament_id) order by tournament_id)
    from club_private.personnel_rosters),'[]'::jsonb);
end;
$$;
revoke all on function public.club_personnel_snapshot() from public,anon;
grant execute on function public.club_personnel_snapshot() to authenticated;

create or replace function public.club_personnel_command(
  p_request_id uuid,p_tournament_id text,p_action text,p_entry_id uuid default null,p_values jsonb default '{}'
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_payload jsonb;
  v_receipt club_private.personnel_requests%rowtype;
  v_roster club_private.personnel_rosters%rowtype;
  v_entry jsonb;
  v_before jsonb;
  v_data jsonb;
  v_allowed text[];
  v_total numeric;
  v_position integer;
  v_stamp timestamptz := clock_timestamp();
begin
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)=''
    or p_action is null or p_action not in ('add_dealer','add_staff','adjust','comment','archive')
    or jsonb_typeof(p_values) is distinct from 'object' then
    raise exception using errcode='22023',message='Invalid personnel request';
  end if;
  v_allowed := case p_action when 'add_dealer' then array['name','minutes']
    when 'add_staff' then array['name','minutes','role'] when 'adjust' then array['delta']
    when 'comment' then array['comment','revision'] else array['reason'] end;
  if (p_values - v_allowed)<>'{}'::jsonb or not(p_values ?& v_allowed)
    or ((p_action in ('add_dealer','add_staff')) <> (p_entry_id is null)) then
    raise exception using errcode='22023',message='Invalid personnel fields';
  end if;
  v_payload := jsonb_build_object('tournament_id',p_tournament_id,'action',p_action,'entry_id',p_entry_id,'values',p_values);
  perform pg_advisory_xact_lock(hashtextextended('showdown-personnel:'||(v_actor->>'id')||':'||p_request_id::text,0));
  select * into v_receipt from club_private.personnel_requests where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_receipt.payload<>v_payload then raise exception using errcode='22023',message='Request identifier already used'; end if;
    return club_private.personnel_json(v_receipt.tournament_id);
  end if;
  perform club_private.ensure_personnel_roster(p_tournament_id);
  select * into strict v_roster from club_private.personnel_rosters where tournament_id=p_tournament_id for update;

  if p_action in ('add_dealer','add_staff') then
    if jsonb_typeof(p_values->'name') is distinct from 'string' or length(btrim(p_values->>'name')) not between 1 and 200
      or jsonb_typeof(p_values->'minutes') is distinct from 'number'
      or (p_action='add_staff' and (jsonb_typeof(p_values->'role') is distinct from 'string'
        or length(btrim(p_values->>'role')) not between 1 and 100)) then
      raise exception using errcode='22023',message='Invalid personnel details';
    end if;
    v_total := (p_values->>'minutes')::numeric;
    if v_total<0 or v_total>600000 or trunc(v_total)<>v_total or (p_action='add_dealer' and v_total=0) then
      raise exception using errcode='22023',message='Invalid personnel hours';
    end if;
    v_data := jsonb_build_object('name',btrim(p_values->>'name'),'hours',trunc(v_total/60),'minutes',mod(v_total,60),'loggedAt',v_stamp);
    if p_action='add_staff' then v_data := v_data || jsonb_build_object('role',btrim(p_values->>'role')); end if;
    v_entry := jsonb_build_object('id',gen_random_uuid(),'kind',case when p_action='add_staff' then 'staff' else 'dealer' end,
      'data',v_data,'archived_at',null,'archive_reason',null);
    v_roster.entries := v_roster.entries || jsonb_build_array(v_entry);
  else
    select e.value,(e.ordinality-1)::integer into v_entry,v_position
    from jsonb_array_elements(v_roster.entries) with ordinality e where e.value->>'id'=p_entry_id::text;
    if not found then raise exception using errcode='22023',message='Unknown personnel entry'; end if;
    v_before := v_entry;
    if v_entry->>'archived_at' is not null then raise exception using errcode='22023',message='Personnel entry archived'; end if;
    v_data := v_entry->'data';
    if p_action='adjust' then
      if jsonb_typeof(p_values->'delta') is distinct from 'number' or (p_values->>'delta')::numeric not in (-30,30) then
        raise exception using errcode='22023',message='Half-hour adjustment required';
      end if;
      v_total := greatest(0,(v_data->>'hours')::numeric*60+(v_data->>'minutes')::numeric+(p_values->>'delta')::numeric);
      if v_total>600000 then raise exception using errcode='22023',message='Personnel hours exceed limit'; end if;
      v_data := v_data || jsonb_build_object('hours',trunc(v_total/60),'minutes',mod(v_total,60),'loggedAt',v_stamp);
    elsif p_action='comment' then
      if jsonb_typeof(p_values->'comment') is distinct from 'string' or length(btrim(p_values->>'comment'))>1000
        or jsonb_typeof(p_values->'revision') is distinct from 'number' then
        raise exception using errcode='22023',message='Invalid personnel comment';
      end if;
      if (p_values->>'revision')::numeric<>v_roster.revision then
        -- An edit conflict is not a transient database serialization failure to retry.
        raise exception using errcode='PT409',message='Personnel changed; refresh before editing';
      end if;
      v_data := v_data || jsonb_build_object('comment',btrim(p_values->>'comment'));
    else
      if jsonb_typeof(p_values->'reason') is distinct from 'string' or length(btrim(p_values->>'reason')) not between 1 and 1000 then
        raise exception using errcode='22023',message='Archive reason required';
      end if;
      v_entry := v_entry || jsonb_build_object('archived_at',v_stamp,'archive_reason',btrim(p_values->>'reason'));
    end if;
    v_entry := jsonb_set(v_entry,'{data}',v_data);
    v_roster.entries := jsonb_set(v_roster.entries,array[v_position::text],v_entry);
  end if;
  update club_private.personnel_rosters set entries=v_roster.entries,revision=revision+1 where tournament_id=p_tournament_id;
  insert into club_private.personnel_requests(actor_id,request_id,tournament_id,payload)
  values(v_actor->>'id',p_request_id,p_tournament_id,v_payload);
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_tournament_id,target_tournament_name,details)
  select v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Изменил запись персонала',t.id,t.title,
    jsonb_build_object('operation',p_action,'entry_id',v_entry->>'id','kind',v_entry->>'kind',
      'before',v_before,'after',v_entry,'revision',v_roster.revision+1)::text
  from public.tournaments t where t.id=p_tournament_id;
  return club_private.personnel_json(p_tournament_id);
end;
$$;
revoke all on function public.club_personnel_command(uuid,text,text,uuid,jsonb) from public,anon;
grant execute on function public.club_personnel_command(uuid,text,text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
