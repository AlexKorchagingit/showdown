-- One-off: BOUNTY HUNTER 2026-09-20 mixed up Егор and Владимир 32.
--
-- Close recorded Владимир 32 as 1st with 11 knockouts and Егор as 11th with 0.
-- Cashier later swapped finishing places (Егор 1st, Владимир 32 12th) but left
-- knockouts, event rating and credited rubies on the original seats.
-- This finishes the identity swap: Егор keeps 1st and receives 11 bounties,
-- event rating and the 1st+11KO ruby award; Владимир 32 keeps 12th with 0
-- bounties and the 12th-place ruby award. Wallets move by the ruby delta.
--
-- Apply once as supabase_admin. Not a numbered migration.
-- Idempotent via public.logs (script id in details).
-- Does not reopen the tournament or touch any other seat.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

do $$
declare
  v_script constant text := 'swap-egor-vladimir32-bounty-once';
  v_tournament_id constant text := 't-0b50cca0-ed7a-4471-ace5-3d94af5c29de';
  v_egor_id constant text := '85ff0e09-5161-40c9-a705-2636353c53b0';
  v_vlad_id constant text := '127123d5-f828-4ff8-8f4a-864925841939';
  v_tournament public.tournaments%rowtype;
  v_players integer;
  v_egor public.participants%rowtype;
  v_vlad public.participants%rowtype;
  v_egor_user public.users%rowtype;
  v_vlad_user public.users%rowtype;
  v_egor_points integer;
  v_vlad_points integer;
  v_egor_rubies integer;
  v_vlad_rubies integer;
  v_egor_delta integer;
  v_vlad_delta integer;
begin
  if exists (
    select 1 from public.logs
    where action_type = 'Исправил места турнира'
      and target_tournament_id = v_tournament_id
      and details like '%' || v_script || '%'
  ) then
    raise notice 'Already applied % — nothing changed', v_script;
    return;
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_tournament_id
  for update;

  if not found
    or v_tournament.title <> 'BOUNTY HUNTER'
    or v_tournament.start_date <> date '2026-09-20'
    or not v_tournament.is_bounty
    or not v_tournament.is_closed
    or not v_tournament.results_entered
    or not v_tournament.rubies_distributed then
    raise exception using
      errcode = '22023',
      message = 'Unexpected BOUNTY HUNTER 2026-09-20 tournament row';
  end if;

  perform 1
  from public.participants
  where tournament_id = v_tournament_id
  order by id
  for update;

  select count(*) into v_players
  from public.participants
  where tournament_id = v_tournament_id and arrived = true;

  if v_players <> 17 then
    raise exception using
      errcode = '22023',
      message = format('Unexpected arrived field size %s', v_players);
  end if;

  select * into v_egor
  from public.participants
  where tournament_id = v_tournament_id and user_id = v_egor_id;
  if not found then
    raise exception using errcode = '22023', message = 'Егор seat not found';
  end if;

  select * into v_vlad
  from public.participants
  where tournament_id = v_tournament_id and user_id = v_vlad_id;
  if not found then
    raise exception using errcode = '22023', message = 'Владимир 32 seat not found';
  end if;

  if btrim(v_egor.nickname) <> 'Егор'
    or btrim(v_vlad.nickname) <> 'Владимир 32'
    or v_egor.place is distinct from 1
    or v_egor.knockouts is distinct from 0
    or v_egor.rubies_awarded is distinct from 138
    or v_vlad.place is distinct from 12
    or v_vlad.knockouts is distinct from 11
    or v_vlad.rubies_awarded is distinct from 2105 then
    raise exception using
      errcode = '22023',
      message = 'Егор / Владимир 32 seats are not in the expected mixed-up state';
  end if;

  -- Lock wallets in id order (Владимир 32 < Егор) to match club_close_tournament.
  select * into v_vlad_user from public.users where id = v_vlad_id for update;
  if not found or btrim(v_vlad_user.nickname) <> 'Владимир 32' then
    raise exception using errcode = '22023', message = 'Владимир 32 user row mismatch';
  end if;
  select * into v_egor_user from public.users where id = v_egor_id for update;
  if not found or btrim(v_egor_user.nickname) <> 'Егор' then
    raise exception using errcode = '22023', message = 'Егор user row mismatch';
  end if;

  v_egor_points := club_private.tournament_place_points(1, v_players, v_tournament.guarantee)
    + 11 * 100;
  v_vlad_points := club_private.tournament_place_points(12, v_players, v_tournament.guarantee)
    + 0 * 100;
  v_egor_rubies := club_private.tournament_rubies(1, v_players, 11, true);
  v_vlad_rubies := club_private.tournament_rubies(12, v_players, 0, true);
  v_egor_delta := v_egor_rubies - v_egor.rubies_awarded;
  v_vlad_delta := v_vlad_rubies - v_vlad.rubies_awarded;

  if v_egor_points is distinct from 4500
    or v_vlad_points is distinct from 0
    or v_egor_rubies is distinct from 2105
    or v_vlad_rubies is distinct from 138
    or v_egor_delta is distinct from 1967
    or v_vlad_delta is distinct from -1967 then
    raise exception using
      errcode = '22023',
      message = 'Computed awards do not match the expected 1st/11KO vs 12th/0KO swap';
  end if;

  if v_vlad_user.ruby_balance + v_vlad_delta < 0 then
    raise exception using
      errcode = '22023',
      message = format('Владимир 32 ruby balance %s cannot cover debit %s',
        v_vlad_user.ruby_balance, v_vlad_delta);
  end if;

  if v_egor_user.ruby_balance > 2147483647 - v_egor_delta then
    raise exception using
      errcode = '22003',
      message = 'Ruby overflow for Егор';
  end if;

  update public.participants
  set
    knockouts = 11,
    rating = v_egor_points,
    rubies_awarded = v_egor_rubies
  where id = v_egor.id;

  update public.participants
  set
    knockouts = 0,
    rating = v_vlad_points,
    rubies_awarded = v_vlad_rubies
  where id = v_vlad.id;

  update public.users
  set ruby_balance = ruby_balance + v_egor_delta
  where id = v_egor_id;

  update public.users
  set ruby_balance = ruby_balance + v_vlad_delta
  where id = v_vlad_id;

  insert into public.logs (
    admin_id, admin_email, admin_name, action_type,
    target_user_id, target_user_email, target_user_name,
    target_tournament_id, target_tournament_name, details
  ) values (
    null, 'script@local', 'bounty-place-swap', 'Исправил места турнира',
    v_egor_id, v_egor_user.email, v_egor_user.nickname,
    v_tournament.id, v_tournament.title,
    jsonb_build_object(
      'script', v_script,
      'user', 'Егор',
      'place', 1,
      'knockouts_from', v_egor.knockouts,
      'knockouts_to', 11,
      'rating_from', v_egor.rating,
      'rating_to', v_egor_points,
      'rubies_from', v_egor.rubies_awarded,
      'rubies_to', v_egor_rubies,
      'wallet_delta', v_egor_delta
    )::text
  ), (
    null, 'script@local', 'bounty-place-swap', 'Исправил места турнира',
    v_vlad_id, v_vlad_user.email, v_vlad_user.nickname,
    v_tournament.id, v_tournament.title,
    jsonb_build_object(
      'script', v_script,
      'user', 'Владимир 32',
      'place', 12,
      'knockouts_from', v_vlad.knockouts,
      'knockouts_to', 0,
      'rating_from', v_vlad.rating,
      'rating_to', v_vlad_points,
      'rubies_from', v_vlad.rubies_awarded,
      'rubies_to', v_vlad_rubies,
      'wallet_delta', v_vlad_delta
    )::text
  );

  raise notice 'Swapped BOUNTY HUNTER 2026-09-20: Егор 1st/11 KO +%s rubies, Владимир 32 12th/0 KO %s rubies',
    v_egor_delta, v_vlad_delta;
end $$;

commit;
