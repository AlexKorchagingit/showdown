-- Snapshots of the live finish forecast, about one every two hours.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tournaments
  add column if not exists finish_forecasts jsonb not null default '[]'::jsonb;

create or replace function public.club_append_finish_forecast(
  p_tournament_id text,
  p_end text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_end text := btrim(coalesce(p_end, ''));
  v_t public.tournaments%rowtype;
  v_marks jsonb;
  v_last text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  select role into v_role from club_private.profile_roles where user_id = v_actor->>'id';
  if v_role not in ('admin', 'superadmin') then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  if p_tournament_id is null or btrim(p_tournament_id) = ''
     or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception using errcode = '22023', message = 'Укажите прогноз как ЧЧ:ММ';
  end if;
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  v_marks := case when jsonb_typeof(v_t.finish_forecasts) = 'array' then v_t.finish_forecasts else '[]'::jsonb end;
  if v_t.is_closed then
    return v_marks;
  end if;
  v_last := null;
  if jsonb_array_length(v_marks) > 0 then
    v_last := v_marks->-1->>'at';
  end if;
  if v_last is not null
     and v_last ~ '^[0-9]{4}-'
     and v_last::timestamptz > clock_timestamp() - interval '2 hours' then
    return v_marks;
  end if;
  v_marks := v_marks || jsonb_build_array(jsonb_build_object(
    'at', to_jsonb(clock_timestamp()) #>> '{}',
    'end', v_end
  ));
  if jsonb_array_length(v_marks) > 16 then
    select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
      into v_marks
    from (
      select item, ord
      from (
        select item, ord
        from jsonb_array_elements(v_marks) with ordinality as t(item, ord)
        order by ord desc
        limit 16
      ) recent
    ) kept;
  end if;
  update public.tournaments
  set finish_forecasts = v_marks
  where id = p_tournament_id;
  return v_marks;
end;
$$;

revoke all on function public.club_append_finish_forecast(text, text) from public, anon;
grant execute on function public.club_append_finish_forecast(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
