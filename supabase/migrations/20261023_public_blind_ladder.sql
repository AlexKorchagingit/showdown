-- Any signed-in player can read the ladder of one visible tournament.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.club_public_blind_ladder(p_tournament_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_t public.tournaments%rowtype;
  v_payload jsonb;
  v_structure jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if p_tournament_id is null or btrim(p_tournament_id) = '' then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  select role into v_role
  from club_private.profile_roles
  where user_id = v_actor->>'id';
  select * into v_t from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  if v_t.hidden and coalesce(v_role, '') not in ('admin', 'superadmin') then
    raise exception using errcode = '42501', message = 'Tournament is hidden';
  end if;

  select payload into v_payload
  from public.timer_sessions
  where id = 'blind-structures';

  if coalesce(v_t.blind_structure_id, '') <> '' then
    select s into v_structure
    from jsonb_array_elements(coalesce(v_payload->'structures', '[]'::jsonb)) s
    where s->>'id' = v_t.blind_structure_id
    limit 1;
  end if;
  if v_structure is null and coalesce(v_t.blind_structure, '') <> '' then
    select s into v_structure
    from jsonb_array_elements(coalesce(v_payload->'structures', '[]'::jsonb)) s
    where s->>'name' = v_t.blind_structure
    limit 1;
  end if;

  if v_structure is null then
    return jsonb_build_object('id', null, 'name', coalesce(v_t.blind_structure, ''), 'levels', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'id', v_structure->>'id',
    'name', coalesce(v_structure->>'name', v_t.blind_structure),
    'levels', coalesce(v_structure->'levels', '[]'::jsonb)
  );
end;
$$;

revoke all on function public.club_public_blind_ladder(text) from public, anon;
grant execute on function public.club_public_blind_ladder(text) to authenticated;

notify pgrst, 'reload schema';
commit;
