-- Stadium event days get their OWN table — fully separated from events.
-- The Stadium screen reads this; the Events tab/admin never sees them.
create table public.stadium_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  created_at timestamptz not null default now()
);

alter table public.stadium_days enable row level security;
create policy stadium_days_public_read on public.stadium_days
  for select using (true);
create policy stadium_days_staff_all on public.stadium_days
  for all using (public.is_staff()) with check (public.is_staff());

-- default privileges were revoked (hardening) — grant explicitly
grant select on public.stadium_days to anon, authenticated;
grant insert, update, delete on public.stadium_days to authenticated;
grant all on public.stadium_days to service_role;

create trigger audit_stadium_days
  after insert or update or delete on public.stadium_days
  for each row execute function public.write_audit();

-- atomic month replace now targets stadium_days
drop function if exists public.replace_stadium_days(jsonb, jsonb);
create or replace function public.replace_stadium_days(windows jsonb, days jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  w jsonb;
begin
  for w in select * from jsonb_array_elements(windows) loop
    delete from public.stadium_days
     where date >= ((w->>'from')::date)
       and date <  ((w->>'to')::date);
  end loop;
  insert into public.stadium_days (date)
  select (d #>> '{}')::date from jsonb_array_elements(days) as d;
end;
$$;
revoke execute on function public.replace_stadium_days(jsonb, jsonb) from public, anon;
grant execute on function public.replace_stadium_days(jsonb, jsonb) to authenticated;

-- events table no longer carries stadium rows
delete from public.events where category = 'stadium';
