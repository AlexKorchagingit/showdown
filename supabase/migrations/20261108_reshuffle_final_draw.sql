-- An admin can deal the current cashier onto the three tables again.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function club_private.assign_final_draw_box()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box integer;
begin
  if new.tournament_id not in (
    't-21b2bdbf-3744-4db7-810c-dca678462101',
    't-6835c66f-eb54-4a7d-8c0a-25eb44ebae21'
  ) then
    if tg_op = 'INSERT' then
      new.draw_box := null;
    elsif new.draw_box is distinct from old.draw_box then
      new.draw_box := old.draw_box;
    end if;
    return new;
  end if;

  -- The reshuffle command writes the new boxes itself.
  if pg_catalog.current_setting('club.reshuffle_draw', true) = 'on' then
    return new;
  end if;

  if new.arrived is not true then
    new.draw_box := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.arrived is true and old.draw_box is not null then
    new.draw_box := old.draw_box;
    return new;
  end if;

  select box into v_box
  from pg_catalog.generate_series(1, 27) as box
  where not exists (
    select 1
    from public.participants p
    where p.tournament_id = new.tournament_id
      and p.draw_box = box
      and p.id is distinct from new.id
  )
  order by pg_catalog.gen_random_uuid()
  limit 1;

  new.draw_box := v_box;
  return new;
end;
$$;

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
    and arrived;

  with seated as (
    select id, row_number() over (order by random()) as n
    from public.participants
    where tournament_id = p_tournament_id
      and arrived
  ),
  boxes as (
    select box, row_number() over (order by random()) as n
    from pg_catalog.generate_series(1, 27) as box
  )
  update public.participants as player
  set draw_box = picked.box
  from seated
  join boxes as picked on picked.n = seated.n
  where player.id = seated.id
    and seated.n <= 27;

  select count(*) into v_count
  from public.participants
  where tournament_id = p_tournament_id
    and arrived
    and draw_box is not null;

  return jsonb_build_object('tournament_id', p_tournament_id, 'seated', v_count);
end;
$$;

revoke all on function public.club_reshuffle_final_draw(text) from public, anon;
grant execute on function public.club_reshuffle_final_draw(text) to authenticated;

notify pgrst, 'reload schema';
commit;
