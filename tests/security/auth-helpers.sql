-- Supabase's Postgres image normally supplies this helper. Install it after
-- GoTrue's initial migrations when running tests on the official Postgres image.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
