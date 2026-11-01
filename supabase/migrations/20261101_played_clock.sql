-- Start and finish clocks for a night. Existing rows stay empty.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.tournaments
  add column if not exists played_start time,
  add column if not exists played_end time;

create or replace function public.club_save_tournament_clock(
  p_tournament_id text,
  p_start text,
  p_end text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_start text := nullif(btrim(coalesce(p_start, '')), '');
  v_end text := nullif(btrim(coalesce(p_end, '')), '');
  v_t public.tournaments%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  select role into v_role from club_private.profile_roles where user_id = v_actor->>'id';
  if v_role not in ('admin', 'superadmin') then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  if p_tournament_id is null or btrim(p_tournament_id) = ''
     or (v_start is not null and v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_end is not null and v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception using errcode = '22023', message = 'Укажите время как ЧЧ:ММ';
  end if;
  update public.tournaments
  set played_start = case when v_start is null then null else v_start::time end,
      played_end = case when v_end is null then null else v_end::time end
  where id = p_tournament_id
  returning * into v_t;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tournament';
  end if;
  return jsonb_build_object(
    'played_start', to_char(v_t.played_start, 'HH24:MI'),
    'played_end', to_char(v_t.played_end, 'HH24:MI')
  );
end;
$$;

revoke all on function public.club_save_tournament_clock(text, text, text) from public, anon;
grant execute on function public.club_save_tournament_clock(text, text, text) to authenticated;

create or replace function club_private.reject_close_without_clock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_closed and not old.is_closed
     and (new.played_start is null or new.played_end is null) then
    raise exception using errcode = '22023', message = 'Укажите начало и конец турнира';
  end if;
  return new;
end;
$$;

drop trigger if exists tournaments_require_played_clock on public.tournaments;
create trigger tournaments_require_played_clock
  before update on public.tournaments
  for each row execute function club_private.reject_close_without_clock();

notify pgrst, 'reload schema';
commit;
