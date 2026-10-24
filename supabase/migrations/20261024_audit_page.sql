-- Journal opens on the newest page instead of the whole history.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.club_audit_page(
  p_limit integer,
  p_before timestamptz default null,
  p_before_id text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_limit integer;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'SuperAdmin required';
  end if;
  select role into v_role from club_private.profile_roles where user_id = v_actor->>'id';
  if v_role <> 'superadmin' then
    raise exception using errcode = '42501', message = 'SuperAdmin required';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 40), 1), 100);
  select coalesce(jsonb_agg(to_jsonb(page) order by page.timestamp desc, page.id desc), '[]'::jsonb)
    into v_result
  from (
    select entry.*
    from public.logs entry
    where entry.id not in ('blinds-timer-session', 'blinds-structures', 'participant-arrivals')
      and entry.action_type not in ('__timer_session__', '__blind_structures__', '__participant_arrivals__')
      and (
        p_before is null
        or entry.timestamp < p_before
        or (entry.timestamp = p_before and (p_before_id is null or entry.id < p_before_id))
      )
    order by entry.timestamp desc, entry.id desc
    limit v_limit
  ) page;
  return v_result;
end;
$$;

revoke all on function public.club_audit_page(integer, timestamptz, text) from public, anon;
grant execute on function public.club_audit_page(integer, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
commit;
