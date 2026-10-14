-- One-off scoreboard for FREEROLL TEAM BATTLE on 13 Oct 2026
-- (t-9afeed39-2f42-49aa-bf94-d7b36e8a18b0). Other tournaments cannot use it.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.participants
  add column if not exists squad_no smallint,
  add column if not exists squad_points integer;

alter table public.participants drop constraint if exists participants_squad_no_check;
alter table public.participants
  add constraint participants_squad_no_check
  check (squad_no is null or squad_no between 1 and 6);

alter table public.participants drop constraint if exists participants_squad_points_check;
alter table public.participants
  add constraint participants_squad_points_check
  check (squad_points is null or (squad_points >= 0 and squad_points <= 1000000));

create or replace function public.club_save_squad_scores(p_tournament_id text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_t public.tournaments%rowtype;
  v_updated integer := 0;
begin
  if p_tournament_id is distinct from 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0' then
    raise exception using errcode = '22023', message = 'Командный зачёт есть только у турнира 13 октября';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception using errcode = '22023', message = 'Некорректный командный зачёт';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) x
    where jsonb_typeof(x) <> 'object'
      or not x ?& array['seat_id', 'squad_no', 'squad_points']
      or x - array['seat_id', 'squad_no', 'squad_points']::text[] <> '{}'::jsonb
      or jsonb_typeof(x->'seat_id') <> 'string'
      or jsonb_typeof(x->'squad_no') not in ('number', 'null')
      or jsonb_typeof(x->'squad_points') <> 'number'
  ) then
    raise exception using errcode = '22023', message = 'Некорректный командный зачёт';
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found or v_t.start_date <> date '2026-10-13' then
    raise exception using errcode = '22023', message = 'Командный зачёт есть только у турнира 13 октября';
  end if;

  create temporary table squad_desired(
    seat_id text primary key,
    squad_no smallint,
    squad_points integer
  ) on commit drop;
  insert into squad_desired(seat_id, squad_no, squad_points)
  select btrim(x->>'seat_id'),
    case when jsonb_typeof(x->'squad_no') = 'number' then (x->>'squad_no')::smallint end,
    (x->>'squad_points')::integer
  from jsonb_array_elements(p_rows) x;
  if exists (
    select 1 from squad_desired
    where seat_id = ''
      or squad_points is null
      or squad_points < 0
      or squad_points > 1000000
      or (squad_no is not null and squad_no not between 1 and 6)
  ) then
    raise exception using errcode = '22023', message = 'Некорректные очки или номер команды';
  end if;
  if exists (
    select 1 from squad_desired d
    where not exists (
      select 1 from public.participants p
      where p.tournament_id = p_tournament_id and p.id = d.seat_id
    )
  ) then
    raise exception using errcode = '22023', message = 'В зачёте есть игрок не из этого турнира';
  end if;

  update public.participants p
  set squad_no = d.squad_no,
      squad_points = d.squad_points
  from squad_desired d
  where p.tournament_id = p_tournament_id and p.id = d.seat_id;
  get diagnostics v_updated = row_count;

  insert into public.logs(
    admin_id, admin_email, admin_name, action_type,
    target_tournament_id, target_tournament_name, details
  ) values (
    v_actor->>'id', v_actor->>'email', v_actor->>'nickname',
    'Сохранил командный зачёт', v_t.id, v_t.title,
    jsonb_build_object('players', v_updated)::text
  );

  return jsonb_build_object('tournament_id', v_t.id, 'updated', v_updated);
end $$;

revoke all on function public.club_save_squad_scores(text, jsonb) from public, anon;
grant execute on function public.club_save_squad_scores(text, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
