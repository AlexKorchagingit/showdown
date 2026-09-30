-- Mark selected unpaid entry/rebuy/addon rows as a free ticket without changing their type.
-- The plate stays «Вход» / «Ребай» / «Аддон», the amount becomes 0, and the row is paid.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function public.club_comp_charges(p_transaction_ids text[])
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb := club_private.require_finance_admin();
  v_ids text[];
  v_count integer;
  v_tx public.transactions%rowtype;
begin
  if p_transaction_ids is null or cardinality(p_transaction_ids)=0 or cardinality(p_transaction_ids)>500
    or exists(select 1 from unnest(p_transaction_ids) as i(value) where value is null or btrim(value)='') then
    raise exception using errcode='22023', message='Invalid ticket request';
  end if;
  select coalesce(array_agg(distinct btrim(value) order by btrim(value)),'{}'::text[]) into v_ids
  from unnest(p_transaction_ids) as i(value);
  perform id from public.transactions where id = any(v_ids) order by id for update;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then
    raise exception using errcode='22023', message='Unknown transaction';
  end if;
  if exists(select 1 from club_private.transaction_voids where transaction_id=any(v_ids)) then
    raise exception using errcode='22023', message='Cancelled transaction cannot be a ticket';
  end if;
  if exists(
    select 1 from public.transactions
    where id = any(v_ids)
      and (
        type not in ('buy-in','rebuy','addon')
        or (status='paid' and amount<>0)
      )
  ) then
    raise exception using errcode='22023', message='Only an unpaid entry, rebuy or addon can be a ticket';
  end if;
  for v_tx in select * from public.transactions where id = any(v_ids) order by id loop
    if v_tx.amount <> 0 or v_tx.status <> 'paid' then
      update public.transactions
      set amount=0, status='paid', updated_at=clock_timestamp()
      where id=v_tx.id
      returning * into v_tx;
      insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,
        target_user_email,target_user_name,target_tournament_id,target_tournament_name,details)
      select v_actor->>'id', v_actor->>'email', v_actor->>'nickname', 'Зафиксировал билет', u.id,
        u.email, u.nickname, t.id, t.title,
        jsonb_build_object('transaction_id', v_tx.id, 'type', v_tx.type)::text
      from public.users u
      cross join public.tournaments t
      where u.id=v_tx.user_id and t.id=v_tx.tournament_id;
    end if;
    return next club_private.finance_transaction_json(v_tx, true);
  end loop;
end $$;

revoke all on function public.club_comp_charges(text[]) from public, anon;
grant execute on function public.club_comp_charges(text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
