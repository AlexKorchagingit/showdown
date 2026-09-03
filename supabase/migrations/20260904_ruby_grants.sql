-- Stage 2.3d: protected administrative ruby grants and tournament credits.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
create table if not exists club_private.ruby_grant_requests(
  actor_id text not null references public.users(id) on delete restrict,
  request_id uuid not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default clock_timestamp(), primary key(actor_id,request_id));
alter table club_private.ruby_grant_requests enable row level security;
revoke all on club_private.ruby_grant_requests from public,anon,authenticated;

create or replace function public.club_grant_rubies(p_request_id uuid,p_user_id text,
  p_amount integer,p_message text,p_delivery text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor jsonb:=public.club_current_account(); v_role text; v_user public.users%rowtype;
  v_payload jsonb; v_previous record; v_result jsonb; v_notification jsonb;
begin
  if v_actor is null then raise exception using errcode='42501',message='Administrator required'; end if;
  select role into v_role from club_private.profile_roles where user_id=v_actor->>'id' for share;
  if v_role not in ('admin','superadmin') then raise exception using errcode='42501',message='Administrator required'; end if;
  if p_request_id is null or p_user_id is null or btrim(p_user_id)='' or p_amount is null
    or p_amount<1 or p_amount>1000000 or p_delivery not in ('notification','immediate')
    or p_message is null or length(btrim(p_message))<1 or length(btrim(p_message))>1000 then
    raise exception using errcode='22023',message='Invalid ruby grant';
  end if;
  v_payload:=jsonb_build_object('user_id',p_user_id,'amount',p_amount,'message',btrim(p_message),'delivery',p_delivery);
  select * into v_user from public.users where id=p_user_id for update;
  if not found then raise exception using errcode='22023',message='Unknown target account'; end if;
  select payload,result into v_previous from club_private.ruby_grant_requests
    where actor_id=v_actor->>'id' and request_id=p_request_id;
  if found then
    if v_previous.payload<>v_payload then raise exception using errcode='22023',message='Request identifier already used'; end if;
    return v_previous.result;
  end if;
  if p_delivery='immediate' then
    if v_user.ruby_balance>2147483647-p_amount then raise exception using errcode='22003',message='Ruby balance overflow'; end if;
    update public.users set ruby_balance=ruby_balance+p_amount where id=v_user.id;
  else
    v_notification:=jsonb_build_object('id','ruby-'||p_request_id::text,'message',btrim(p_message),'amount',p_amount);
    update public.users set pending_notifications=pending_notifications||jsonb_build_array(v_notification) where id=v_user.id;
  end if;
  insert into public.logs(admin_id,admin_email,admin_name,action_type,target_user_id,target_user_email,target_user_name,details)
  values(v_actor->>'id',v_actor->>'email',v_actor->>'nickname',
    case when p_delivery='immediate' then 'Начислил рубины на баланс' else 'Создал бонус рубинов' end,
    v_user.id,v_user.email,v_user.nickname,jsonb_build_object('amount',p_amount,'message',btrim(p_message),'delivery',p_delivery)::text);
  select jsonb_build_object('request_id',p_request_id,'user_id',v_user.id,'delivery',p_delivery,'amount',p_amount) into v_result;
  insert into club_private.ruby_grant_requests(actor_id,request_id,payload,result)
    values(v_actor->>'id',p_request_id,v_payload,v_result);
  return v_result;
end $$;
revoke all on function public.club_grant_rubies(uuid,text,integer,text,text) from public,anon;
grant execute on function public.club_grant_rubies(uuid,text,integer,text,text) to authenticated;
notify pgrst,'reload schema'; commit;
