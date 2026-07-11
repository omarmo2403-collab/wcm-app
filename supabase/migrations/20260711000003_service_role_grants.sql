-- service_role bypasses RLS but still needs table-level privileges
-- (tables created in migrations don't inherit the platform's default grants).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- keep future migration-created tables covered for all API roles
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
