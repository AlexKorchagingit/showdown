-- Stage 2.3j: server-authoritative tournament creation/update and final tournament ACL.
-- Physical tournament deletion stays disabled because it would cascade into financial history.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table if not exists club_private.tournament_write_requests(
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null,
  action text not null check(action in ('create','update')),
  tournament_id text not null references public.tournaments(id) on delete restrict,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,request_id)
);
alter table club_private.tournament_write_requests enable row level security;
revoke all on club_private.tournament_write_requests from public,anon,authenticated;

create or replace function club_private.validate_tournament_values(p_values jsonb,p_create boolean)
returns void language plpgsql set search_path='' as $$
declare v_allowed constant text[]:=array['title','image_url','address','start_date','start_time','total_seats',
  'guarantee','about','features','late_reg_until','blind_structure','blind_structure_id','stack_size',
  'level_duration','is_bounty','admin_secret_comment'];
begin
  if p_values is null or jsonb_typeof(p_values)<>'object' or p_values-v_allowed<>'{}'::jsonb
    or (not p_create and p_values='{}'::jsonb) then
    raise exception using errcode='22023',message='Invalid tournament fields';
  end if;
  if p_create and not p_values ?& v_allowed then
    raise exception using errcode='22023',message='Missing tournament fields';
  end if;
  if (p_values ? 'title' and jsonb_typeof(p_values->'title')<>'string')
    or (p_values ? 'image_url' and jsonb_typeof(p_values->'image_url')<>'string')
    or (p_values ? 'address' and jsonb_typeof(p_values->'address')<>'string')
    or (p_values ? 'start_date' and jsonb_typeof(p_values->'start_date')<>'string')
    or (p_values ? 'start_time' and jsonb_typeof(p_values->'start_time')<>'string')
    or (p_values ? 'total_seats' and jsonb_typeof(p_values->'total_seats')<>'number')
    or (p_values ? 'guarantee' and jsonb_typeof(p_values->'guarantee')<>'number')
    or (p_values ? 'about' and jsonb_typeof(p_values->'about')<>'string')
    or (p_values ? 'features' and jsonb_typeof(p_values->'features')<>'array')
    or (p_values ? 'late_reg_until' and jsonb_typeof(p_values->'late_reg_until')<>'string')
    or (p_values ? 'blind_structure' and jsonb_typeof(p_values->'blind_structure')<>'string')
    or (p_values ? 'blind_structure_id' and jsonb_typeof(p_values->'blind_structure_id') not in ('string','null'))
    or (p_values ? 'stack_size' and jsonb_typeof(p_values->'stack_size')<>'number')
    or (p_values ? 'level_duration' and jsonb_typeof(p_values->'level_duration')<>'string')
    or (p_values ? 'is_bounty' and jsonb_typeof(p_values->'is_bounty')<>'boolean')
    or (p_values ? 'admin_secret_comment' and jsonb_typeof(p_values->'admin_secret_comment') not in ('string','null')) then
    raise exception using errcode='22023',message='Invalid tournament field types';
  end if;
  if (p_values ? 'title' and length(btrim(p_values->>'title')) not between 1 and 200)
    or (p_values ? 'image_url' and length(p_values->>'image_url')>2000000)
    or (p_values ? 'address' and length(p_values->>'address')>1000)
    or (p_values ? 'about' and length(p_values->>'about')>20000)
    or (p_values ? 'blind_structure' and length(p_values->>'blind_structure')>500)
    or (p_values ? 'blind_structure_id' and length(coalesce(p_values->>'blind_structure_id',''))>500)
    or (p_values ? 'level_duration' and length(p_values->>'level_duration') not between 1 and 100)
    or (p_values ? 'admin_secret_comment' and length(coalesce(p_values->>'admin_secret_comment',''))>10000)
    or (p_values ? 'start_date' and (p_values->>'start_date' !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char((p_values->>'start_date')::date,'YYYY-MM-DD')<>p_values->>'start_date'))
    or (p_values ? 'start_time' and p_values->>'start_time' !~ '^([01]\d|2[0-3]):[0-5]\d$')
    or (p_values ? 'late_reg_until' and p_values->>'late_reg_until'<>''
      and p_values->>'late_reg_until' !~ '^([01]\d|2[0-3]):[0-5]\d$')
    or (p_values ? 'total_seats' and ((p_values->>'total_seats')::numeric<>trunc((p_values->>'total_seats')::numeric)
      or (p_values->>'total_seats')::numeric not between 1 and 500))
    or (p_values ? 'guarantee' and ((p_values->>'guarantee')::numeric<>trunc((p_values->>'guarantee')::numeric)
      or (p_values->>'guarantee')::numeric not between 0 and 2147483647))
    or (p_values ? 'stack_size' and ((p_values->>'stack_size')::numeric<>trunc((p_values->>'stack_size')::numeric)
      or (p_values->>'stack_size')::numeric not between 1 and 2147483647)) then
    raise exception using errcode='22023',message='Invalid tournament values';
  end if;
  if p_values ? 'features' and (jsonb_array_length(p_values->'features')>50
    or exists(select 1 from jsonb_array_elements(p_values->'features') x
      where jsonb_typeof(x)<>'string' or length(x#>>'{}')>500)) then
    raise exception using errcode='22023',message='Invalid tournament features';
  end if;
end $$;
revoke all on function club_private.validate_tournament_values(jsonb,boolean) from public,anon,authenticated;

create or replace function public.club_tournament_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id';
  select coalesce(jsonb_agg((to_jsonb(t)-array['staff','dealers','admin_secret_comment'])
      ||jsonb_build_object('staff','[]'::jsonb,'dealers','[]'::jsonb,'admin_secret_comment',
        case when v_role in ('admin','superadmin') then to_jsonb(t.admin_secret_comment) else 'null'::jsonb end)
      order by t.start_date desc,t.start_time desc,t.id),'[]'::jsonb)
    into v_result from public.tournaments t;
  return v_result;
end $$;
revoke all on function public.club_tournament_snapshot() from public,anon;
grant execute on function public.club_tournament_snapshot() to authenticated;

create or replace function public.club_create_tournament(p_request_id uuid,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_previous record;v_t public.tournaments%rowtype;
  v_id text;v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null then raise exception using errcode='22023',message='Invalid request identifier'; end if;
  perform club_private.validate_tournament_values(p_values,true);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((v_actor->>'id')||':'||p_request_id::text,0));
  select action,payload,result into v_previous from club_private.tournament_write_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.action<>'create' or v_previous.payload<>p_values then
      raise exception using errcode='22023',message='Request identifier already used';
    end if;
    return v_previous.result;
  end if;
  v_id:='t-'||p_request_id::text;
  insert into public.tournaments(id,title,image_url,address,start_date,start_time,total_seats,guarantee,about,
    features,late_reg_until,blind_structure,blind_structure_id,stack_size,level_duration,is_bounty,admin_secret_comment)
  values(v_id,btrim(p_values->>'title'),p_values->>'image_url',p_values->>'address',(p_values->>'start_date')::date,
    p_values->>'start_time',(p_values->>'total_seats')::integer,(p_values->>'guarantee')::integer,p_values->>'about',
    array(select value#>>'{}' from jsonb_array_elements(p_values->'features') value),p_values->>'late_reg_until',
    p_values->>'blind_structure',nullif(p_values->>'blind_structure_id',''),(p_values->>'stack_size')::integer,
    p_values->>'level_duration',(p_values->>'is_bounty')::boolean,nullif(btrim(coalesce(p_values->>'admin_secret_comment','')),''))
  returning * into v_t;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_tournament_id,target_tournament_name,details)
  values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Создал турнир',v_t.id,v_t.title,
    jsonb_build_object('start_date',v_t.start_date,'total_seats',v_t.total_seats)::text);
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',v_t.id,'tournament',to_jsonb(v_t));
  insert into club_private.tournament_write_requests(actor_id,request_id,action,tournament_id,payload,result)
    values(v_actor->>'id',p_request_id,'create',v_t.id,p_values,v_result);
  return v_result;
end $$;

create or replace function public.club_update_tournament(p_request_id uuid,p_tournament_id text,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_previous record;v_t public.tournaments%rowtype;
  v_result jsonb;v_players integer;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null or p_tournament_id is null or btrim(p_tournament_id)='' then
    raise exception using errcode='22023',message='Invalid tournament request'; end if;
  perform club_private.validate_tournament_values(p_changes,false);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((v_actor->>'id')||':'||p_request_id::text,0));
  select action,payload,result into v_previous from club_private.tournament_write_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.action<>'update' or v_previous.payload<>jsonb_build_object('tournament_id',p_tournament_id,'changes',p_changes) then
      raise exception using errcode='22023',message='Request identifier already used';
    end if;
    return v_previous.result;
  end if;
  select * into v_t from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception using errcode='22023',message='Unknown tournament'; end if;
  select count(*) into v_players from public.participants where tournament_id=p_tournament_id;
  if p_changes ? 'total_seats' and (p_changes->>'total_seats')::integer<v_players then
    raise exception using errcode='22023',message='Total seats cannot be below occupied seats'; end if;
  if (v_t.is_closed or v_t.results_entered or v_t.rubies_distributed)
    and (p_changes ? 'guarantee' or p_changes ? 'is_bounty') then
    raise exception using errcode='22023',message='Scoring settings are locked after closure'; end if;
  update public.tournaments set
    title=case when p_changes ? 'title' then btrim(p_changes->>'title') else title end,
    image_url=case when p_changes ? 'image_url' then p_changes->>'image_url' else image_url end,
    address=case when p_changes ? 'address' then p_changes->>'address' else address end,
    start_date=case when p_changes ? 'start_date' then (p_changes->>'start_date')::date else start_date end,
    start_time=case when p_changes ? 'start_time' then p_changes->>'start_time' else start_time end,
    total_seats=case when p_changes ? 'total_seats' then (p_changes->>'total_seats')::integer else total_seats end,
    guarantee=case when p_changes ? 'guarantee' then (p_changes->>'guarantee')::integer else guarantee end,
    about=case when p_changes ? 'about' then p_changes->>'about' else about end,
    features=case when p_changes ? 'features' then array(select value#>>'{}' from jsonb_array_elements(p_changes->'features') value) else features end,
    late_reg_until=case when p_changes ? 'late_reg_until' then p_changes->>'late_reg_until' else late_reg_until end,
    blind_structure=case when p_changes ? 'blind_structure' then p_changes->>'blind_structure' else blind_structure end,
    blind_structure_id=case when p_changes ? 'blind_structure_id' then nullif(p_changes->>'blind_structure_id','') else blind_structure_id end,
    stack_size=case when p_changes ? 'stack_size' then (p_changes->>'stack_size')::integer else stack_size end,
    level_duration=case when p_changes ? 'level_duration' then p_changes->>'level_duration' else level_duration end,
    is_bounty=case when p_changes ? 'is_bounty' then (p_changes->>'is_bounty')::boolean else is_bounty end,
    admin_secret_comment=case when p_changes ? 'admin_secret_comment' then nullif(btrim(coalesce(p_changes->>'admin_secret_comment','')),'') else admin_secret_comment end
    where id=p_tournament_id returning * into v_t;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_tournament_id,target_tournament_name,details)
  values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Изменил турнир',v_t.id,v_t.title,
    jsonb_build_object('fields',(select jsonb_agg(key order by key) from jsonb_object_keys(p_changes) key))::text);
  v_result:=jsonb_build_object('request_id',p_request_id,'tournament_id',v_t.id,'tournament',to_jsonb(v_t));
  insert into club_private.tournament_write_requests(actor_id,request_id,action,tournament_id,payload,result)
    values(v_actor->>'id',p_request_id,'update',v_t.id,jsonb_build_object('tournament_id',p_tournament_id,'changes',p_changes),v_result);
  return v_result;
end $$;

revoke all on function public.club_create_tournament(uuid,jsonb) from public,anon;
revoke all on function public.club_update_tournament(uuid,text,jsonb) from public,anon;
grant execute on function public.club_create_tournament(uuid,jsonb) to authenticated;
grant execute on function public.club_update_tournament(uuid,text,jsonb) to authenticated;
drop policy if exists tournaments_admin_insert on public.tournaments;
drop policy if exists tournaments_admin_update on public.tournaments;
drop policy if exists tournaments_admin_delete on public.tournaments;
drop policy if exists tournaments_read_authorized on public.tournaments;
revoke select,insert,update,delete on public.tournaments from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
