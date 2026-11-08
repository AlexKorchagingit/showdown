-- Reshuffle only cashier players who have not been marked out.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.club_reshuffle_final_draw(p_tournament_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor jsonb := public.club_current_account();
  v_role text;
  v_count integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  select role into v_role from club_private.profile_roles where user_id = v_actor->>'id';
  if v_role not in ('admin', 'superadmin') then
    raise exception using errcode = '42501', message = 'Administrator required';
  end if;
  if p_tournament_id is null or p_tournament_id not in (
    't-21b2bdbf-3744-4db7-810c-dca678462101',
    't-6835c66f-eb54-4a7d-8c0a-25eb44ebae21'
  ) then
    raise exception using errcode = '22023', message = 'Рассадка для этого турнира не включена';
  end if;

  perform pg_catalog.set_config('club.reshuffle_draw', 'on', true);

  update public.participants
  set draw_box = null
  where tournament_id = p_tournament_id
    and arrived
    and place is null;

  with seated as (
    select id, row_number() over (order by random()) as n
    from public.participants
    where tournament_id = p_tournament_id
      and arrived
      and place is null
  ),
  boxes as (
    select box, row_number() over (order by random()) as n
    from pg_catalog.generate_series(1, 27) as box
    where not exists (
      select 1
      from public.participants taken
      where taken.tournament_id = p_tournament_id
        and taken.draw_box = box
    )
  )
  update public.participants as player
  set draw_box = picked.box
  from seated
  join boxes as picked on picked.n = seated.n
  where player.id = seated.id;

  select count(*) into v_count
  from public.participants
  where tournament_id = p_tournament_id
    and arrived
    and place is null
    and draw_box is not null;

  return jsonb_build_object('tournament_id', p_tournament_id, 'seated', v_count);
end;
$$;

revoke all on function public.club_reshuffle_final_draw(text) from public, anon;
grant execute on function public.club_reshuffle_final_draw(text) to authenticated;

notify pgrst, 'reload schema';
commit;
