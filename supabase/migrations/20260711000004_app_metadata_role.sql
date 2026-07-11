-- Read the staff role from auth app_metadata (set via the Admin API), which is
-- embedded in every JWT — no custom access-token hook needed.
-- Falls back to a top-level claim for forward compatibility.
create or replace function public.jwt_role() returns text
language sql stable as $$
  select coalesce(
    nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role', ''), ''),
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'app_role', '')
  )
$$;
