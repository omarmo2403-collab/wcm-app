-- Ask the Scholar: congregants submit questions from the app (anon INSERT
-- only — no reads), staff read/manage them in the admin dashboard.

create table public.scholar_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  question text not null check (char_length(question) between 6 and 4000),
  status text not null default 'new' check (status in ('new', 'answered', 'archived'))
);

alter table public.scholar_questions enable row level security;

-- app users may only submit; they can never read others' questions
create policy anon_insert_scholar_questions on public.scholar_questions
  for insert to anon with check (true);

create policy staff_all_scholar_questions on public.scholar_questions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant insert on public.scholar_questions to anon;
grant select, insert, update, delete on public.scholar_questions to authenticated;

create trigger audit_scholar_questions after insert or update or delete on public.scholar_questions
  for each row execute function public.write_audit();
