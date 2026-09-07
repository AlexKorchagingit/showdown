-- Read-only production verification. This script returns security metadata
-- only: no emails, profile IDs, tokens, balances or business rows.
begin transaction read only;
set local statement_timeout='15s';

select 'roles|'||role||'|'||count(*)
from club_private.profile_roles group by role order by role;
select 'profiles|'||count(*) from public.users;
select 'auth_links|'||count(*) from club_private.auth_links;
select 'anon_tables|'||count(*) from pg_class c
where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','v','m','f')
  and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'));
select 'anon_functions|'||count(*) from pg_proc p
where p.pronamespace='public'::regnamespace and has_function_privilege('anon',p.oid,'EXECUTE');
select 'authenticated_writes|'||count(*) from pg_class c
where c.relnamespace in ('public'::regnamespace,'club_private'::regnamespace)
  and c.relkind in ('r','p','v','m','f')
  and (has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('authenticated',c.oid,'INSERT,UPDATE,REFERENCES'));
select 'authenticated_public_functions|'||count(*) from pg_proc p
where p.pronamespace='public'::regnamespace
  and has_function_privilege('authenticated',p.oid,'EXECUTE');
select 'authenticated_function|'||p.oid::regprocedure::text from pg_proc p
where p.pronamespace='public'::regnamespace
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
order by p.oid::regprocedure::text;
select 'authenticated_private_functions|'||count(*) from pg_proc p
where p.pronamespace='club_private'::regnamespace
  and has_function_privilege('authenticated',p.oid,'EXECUTE');
select 'authenticated_private_schema|'||has_schema_privilege('authenticated','club_private','USAGE');
select 'true_policies|'||count(*) from pg_policies
where schemaname='public'
  and (coalesce(qual,'')~'^\s*true\s*$' or coalesce(with_check,'')~'^\s*true\s*$');

rollback;
