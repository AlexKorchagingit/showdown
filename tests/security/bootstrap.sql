-- Synthetic local environment ONLY. Never execute against a hosted database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password 'showdown-local-test-only';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole password 'showdown-local-test-only';
create schema auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth, public;
grant usage on schema auth, public to anon, authenticated, service_role;
grant all on schema public to postgres;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;
alter function auth.uid() owner to supabase_auth_admin;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
alter function auth.jwt() owner to supabase_auth_admin;
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
create table public.showdown_local_test_marker (id boolean primary key check (id));
insert into public.showdown_local_test_marker values (true);
revoke all on public.showdown_local_test_marker from public, anon, authenticated, service_role;
