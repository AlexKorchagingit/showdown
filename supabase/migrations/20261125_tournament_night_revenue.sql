-- A tournament night runs past midnight. The month ledger must include the previous
-- evening, and every charge of a tournament that started on or after that evening.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.club_finance_snapshot(p_scope text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_actor jsonb := public.club_current_account();
  v_admin boolean;
  v_from timestamptz;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if p_scope is null or p_scope not in ('all','month') then
    raise exception using errcode='22023',message='Invalid finance scope';
  end if;
  v_admin := v_actor->>'role' in ('admin','superadmin');
  v_from := date_trunc('month', clock_timestamp() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';
  return jsonb_build_object(
    'transactions',coalesce((select jsonb_agg(club_private.finance_transaction_json(t,v_admin) order by t.date desc,t.id)
      from public.transactions t
      where (v_admin or t.user_id=v_actor->>'id')
        and (
          p_scope='all'
          or t.status='unpaid'
          or t.date >= v_from - interval '18 hours'
          or exists (
            select 1 from public.tournaments n
            where n.id = t.tournament_id
              and n.start_date >= ((v_from at time zone 'Europe/Moscow')::date - 1)
          )
          or exists (
            select 1 from club_private.transaction_voids v
            where v.transaction_id=t.id and v.voided_at >= v_from - interval '18 hours'
          )
        )), '[]'::jsonb),
    'dealer_hours',coalesce((select jsonb_agg(to_jsonb(h) order by h.tournament_id,h.user_id)
      from club_private.dealer_hours h where v_admin or h.user_id=v_actor->>'id'),'[]'::jsonb)
  );
end $$;

revoke all on function public.club_finance_snapshot(text) from public, anon;
grant execute on function public.club_finance_snapshot(text) to authenticated;

notify pgrst, 'reload schema';
commit;
