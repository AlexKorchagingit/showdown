-- Stage 2.3f: allow only a signed-in user to edit safe profile fields.
-- LOCAL ONLY until the coordinated cutover.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create or replace function public.club_update_profile(p_changes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor jsonb:=public.club_current_account();
  v_user public.users%rowtype;
  v_role text;
  v_birth text;
begin
  if v_actor is null then raise exception using errcode='42501',message='Verified account required'; end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb
    or p_changes-array['nickname','birth_date','slogan']::text[]<>'{}'::jsonb then
    raise exception using errcode='22023',message='Unsupported profile change';
  end if;
  if exists(select 1 from jsonb_each(p_changes) field where jsonb_typeof(field.value)<>'string') then
    raise exception using errcode='22023',message='Profile values must be text';
  end if;
  if p_changes ? 'nickname' and (length(btrim(p_changes->>'nickname'))<1
    or length(btrim(p_changes->>'nickname'))>17) then
    raise exception using errcode='22023',message='Nickname must contain 1 to 17 characters';
  end if;
  if p_changes ? 'slogan' and length(btrim(p_changes->>'slogan'))>60 then
    raise exception using errcode='22023',message='Slogan is too long';
  end if;
  if p_changes ? 'birth_date' then
    v_birth:=p_changes->>'birth_date';
    if v_birth<>'' and (v_birth!~'^\d{4}-\d{2}-\d{2}$'
      or to_char(to_date(v_birth,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_birth) then
      raise exception using errcode='22023',message='Invalid birth date';
    end if;
  end if;

  select * into v_user from public.users where id=v_actor->>'id' for update;
  if not found then raise exception using errcode='42501',message='Verified account required'; end if;
  update public.users set
    nickname=case when p_changes ? 'nickname' then btrim(p_changes->>'nickname') else nickname end,
    birth_date=case when p_changes ? 'birth_date' then p_changes->>'birth_date' else birth_date end,
    slogan=case when p_changes ? 'slogan' then btrim(p_changes->>'slogan') else slogan end
    where id=v_user.id returning * into v_user;
  select role into strict v_role from club_private.profile_roles where user_id=v_user.id;
  return to_jsonb(v_user)||jsonb_build_object('role',v_role,'is_admin',v_role in ('admin','superadmin'));
end $$;

revoke all on function public.club_update_profile(jsonb) from public,anon;
grant execute on function public.club_update_profile(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
