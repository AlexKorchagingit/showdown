-- Bind a nick-only player (`guest-…`) to a real club account in every tournament at once.
-- The seat keeps its place, knockouts, comment and check-in. Only its identity changes:
-- the primary key becomes `<tournament>:<user>`, the nickname becomes the account's nickname,
-- teammate pointers and the cashier charges follow. Rubies and rating snapshots are not touched.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function public.club_bind_guest_nick(p_guest_key text, p_user_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_key text := btrim(coalesce(p_guest_key,''));
  v_user public.users%rowtype;
  v_tournaments text[];
  v_clash text;
  v_seats integer := 0;
  v_charges integer := 0;
begin
  if v_key !~ '^guest-[0-9a-zа-яё-]{1,60}$' or p_user_id is null or btrim(p_user_id)='' then
    raise exception using errcode='22023', message='Некорректный ник или игрок';
  end if;
  select * into v_user from public.users where id=btrim(p_user_id);
  if not found or exists(select 1 from club_private.archived_profiles a where a.user_id=v_user.id) then
    raise exception using errcode='22023', message='Игрок не найден';
  end if;

  select coalesce(array_agg(distinct p.tournament_id order by p.tournament_id),'{}'::text[])
    into v_tournaments
  from public.participants p
  where p.user_id is null and (p.id=p.tournament_id||':'||v_key or p.id=v_key);

  perform 1 from public.tournaments t where t.id=any(v_tournaments) order by t.id for update;

  select t.title||' · '||t.start_date::text into v_clash
  from public.participants g
  join public.participants o on o.tournament_id=g.tournament_id
    and (o.user_id=v_user.id or o.id=g.tournament_id||':'||v_user.id)
  join public.tournaments t on t.id=g.tournament_id
  where g.user_id is null and (g.id=g.tournament_id||':'||v_key or g.id=v_key)
  limit 1;
  if found then
    raise exception using errcode='22023',
      message='Игрок уже есть в турнире «'||v_clash||'». Уберите дубль и повторите.';
  end if;

  update public.participants p set
    id=p.tournament_id||':'||v_user.id,
    user_id=v_user.id,
    nickname=v_user.nickname,
    roster_revision=coalesce(p.roster_revision,0)+1
  where p.user_id is null and (p.id=p.tournament_id||':'||v_key or p.id=v_key);
  get diagnostics v_seats = row_count;

  update public.participants p set
    team_partner_id=v_user.id,
    roster_revision=coalesce(p.roster_revision,0)+1
  where p.tournament_id=any(v_tournaments)
    and (p.team_partner_id=v_key or p.team_partner_id=p.tournament_id||':'||v_key);

  update public.transactions set user_id=v_user.id, guest_seat_id=null, updated_at=clock_timestamp()
  where user_id is null and guest_seat_id=v_key;
  get diagnostics v_charges = row_count;

  if v_seats>0 or v_charges>0 then
    insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
      target_user_email,target_user_name,details)
    values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname','Привязал ник к игроку',
      v_user.id,v_user.email,v_user.nickname,
      jsonb_build_object('nick',v_key,'tournaments',v_seats,'charges',v_charges)::text);
  end if;

  return jsonb_build_object('tournaments',v_seats,'charges',v_charges);
end $$;

revoke all on function public.club_bind_guest_nick(text,text) from public,anon;
grant execute on function public.club_bind_guest_nick(text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
