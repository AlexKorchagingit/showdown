-- Finish forecasts and played clocks stay on the admin snapshot only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.club_tournament_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account();v_role text;v_result jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id';
  select coalesce(jsonb_agg(
      (
        case
          when v_role in ('admin','superadmin') then to_jsonb(t)-array['staff','dealers','admin_secret_comment']
          else to_jsonb(t)-array['staff','dealers','admin_secret_comment','finish_forecasts','played_start','played_end']
        end
      )
      || jsonb_build_object(
        'staff','[]'::jsonb,
        'dealers','[]'::jsonb,
        'admin_secret_comment', case when v_role in ('admin','superadmin') then to_jsonb(t.admin_secret_comment) else 'null'::jsonb end,
        'occupied_count', (
          select count(*)::int from public.participants p
          where p.tournament_id=t.id and (p.user_id is not null or p.id like '%:guest-%')
        ),
        'arrived_count', (
          select count(*)::int from public.participants p
          where p.tournament_id=t.id and p.arrived and (p.user_id is not null or p.id like '%:guest-%')
        )
      )
      order by t.start_date desc,t.start_time desc,t.id),'[]'::jsonb)
    into v_result from public.tournaments t
    where v_role in ('admin','superadmin') or t.hidden is not true;
  return v_result;
end $$;

revoke all on function public.club_tournament_snapshot() from public, anon;
grant execute on function public.club_tournament_snapshot() to authenticated;

notify pgrst, 'reload schema';
commit;
