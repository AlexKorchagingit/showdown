-- Server-side email OTP storage. Codes are stored only as HMAC hashes.
create table if not exists public.login_otp_requests (
  email text primary key,
  code_hash text not null,
  request_ip_hash text not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5)
);

create index if not exists login_otp_requests_ip_time_idx
  on public.login_otp_requests (request_ip_hash, requested_at desc);

alter table public.login_otp_requests enable row level security;
revoke all on table public.login_otp_requests from public, anon, authenticated;
grant all on table public.login_otp_requests to service_role;

create or replace function public.issue_login_otp(
  p_email text,
  p_code_hash text,
  p_ip_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('showdown_login_otp_issue'));

  delete from public.login_otp_requests
  where expires_at < now() - interval '1 day';

  if exists (
    select 1 from public.login_otp_requests
    where email = p_email
      and requested_at > now() - interval '60 seconds'
  ) then
    return 'email_rate_limited';
  end if;

  if (
    select count(*) from public.login_otp_requests
    where request_ip_hash = p_ip_hash
      and requested_at > now() - interval '15 minutes'
  ) >= 5 then
    return 'ip_rate_limited';
  end if;

  if exists (
    select 1 from public.login_otp_requests
    where requested_at > now() - interval '1100 milliseconds'
  ) then
    return 'global_rate_limited';
  end if;

  insert into public.login_otp_requests (
    email,
    code_hash,
    request_ip_hash,
    requested_at,
    expires_at,
    attempt_count
  )
  values (
    p_email,
    p_code_hash,
    p_ip_hash,
    now(),
    now() + interval '10 minutes',
    0
  )
  on conflict (email) do update set
    code_hash = excluded.code_hash,
    request_ip_hash = excluded.request_ip_hash,
    requested_at = excluded.requested_at,
    expires_at = excluded.expires_at,
    attempt_count = 0;

  return 'issued';
end;
$$;

create or replace function public.cancel_login_otp(
  p_email text,
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.login_otp_requests
  where email = p_email and code_hash = p_code_hash;
  return 'cancelled';
end;
$$;

create or replace function public.verify_login_otp(
  p_email text,
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.login_otp_requests%rowtype;
begin
  select * into current_request
  from public.login_otp_requests
  where email = p_email
  for update;

  if not found then
    return 'invalid';
  end if;

  if current_request.expires_at <= now() then
    delete from public.login_otp_requests where email = p_email;
    return 'expired';
  end if;

  if current_request.attempt_count >= 5 then
    delete from public.login_otp_requests where email = p_email;
    return 'locked';
  end if;

  if current_request.code_hash <> p_code_hash then
    if current_request.attempt_count + 1 >= 5 then
      delete from public.login_otp_requests where email = p_email;
      return 'locked';
    end if;

    update public.login_otp_requests
    set attempt_count = attempt_count + 1
    where email = p_email;
    return 'invalid';
  end if;

  delete from public.login_otp_requests where email = p_email;
  return 'verified';
end;
$$;

revoke all on function public.issue_login_otp(text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_login_otp(text, text) from public, anon, authenticated;
revoke all on function public.verify_login_otp(text, text) from public, anon, authenticated;
grant execute on function public.issue_login_otp(text, text, text) to service_role;
grant execute on function public.cancel_login_otp(text, text) to service_role;
grant execute on function public.verify_login_otp(text, text) to service_role;

