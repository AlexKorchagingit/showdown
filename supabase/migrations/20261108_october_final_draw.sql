-- Random 3×9 seating for FINAL OF OCTOBER, the same rule as September.
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

do $$
declare
  v_id text;
begin
  for v_id in
    select id
    from public.participants
    where tournament_id = 't-6835c66f-eb54-4a7d-8c0a-25eb44ebae21'
      and arrived
      and draw_box is null
    order by id
  loop
    update public.participants
    set arrived = arrived
    where id = v_id;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
