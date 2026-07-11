-- WCM app initial schema (docs/REBUILD_PLAN.md §7)
-- Posture: default-deny RLS; anon may only SELECT published/active rows;
-- all writes require an admin/editor role claim set by the access-token hook.

-- ============ helper: role claim readers ============
create or replace function public.jwt_role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role', '')
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.jwt_role() = 'admin' $$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select public.jwt_role() in ('admin', 'editor') $$;

-- ============ prayer_times ============
create table public.prayer_times (
  date date primary key,
  fajr_begins time not null,
  fajr_iqamah time not null,
  sunrise time not null,
  zuhr_begins time not null,
  zuhr_iqamah time not null,
  asr_begins time not null,
  asr_iqamah time not null,
  maghrib_begins time not null,
  maghrib_iqamah time not null,
  isha_begins time not null,
  isha_iqamah time not null,
  suhoor_ends time,
  iftar time,
  notes text,
  updated_at timestamptz not null default now(),
  -- iqamah can never precede the prayer's begins time
  constraint fajr_order check (fajr_iqamah >= fajr_begins),
  constraint zuhr_order check (zuhr_iqamah >= zuhr_begins),
  constraint asr_order check (asr_iqamah >= asr_begins),
  constraint maghrib_order check (maghrib_iqamah >= maghrib_begins),
  constraint isha_order check (isha_iqamah >= isha_begins)
);

create table public.jumuah_times (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  khutbah_time time not null,
  iqamah_time time not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ============ content tables ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  category text not null default 'community'
    check (category in ('community','lecture','madrasah','stadium','ramadan','eid','fundraising')),
  location text,
  image_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_path text,
  published_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  badge text not null default '',
  title text not null,
  subtitle text not null default '',
  action_type text not null default 'none' check (action_type in ('screen','url','none')),
  action_target text,
  image_path text,
  sort_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  icon text not null default 'info',
  message text not null,
  action_type text not null default 'none' check (action_type in ('screen','url','none')),
  action_target text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

create table public.donation_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  icon text not null default 'heart',
  url text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.madrasah_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  days text not null,
  time_range text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  icon text not null default 'star',
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  is_published boolean not null default true
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============ audit log ============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.write_audit() returns trigger
language plpgsql security definer as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
begin
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, diff)
  values (
    nullif(claims ->> 'sub', '')::uuid,
    claims ->> 'email',
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE'
      then coalesce(old.id::text, '')
      else coalesce(new.id::text, '') end,
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
         when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
         else jsonb_build_object('old', to_jsonb(old)) end
  );
  return coalesce(new, old);
end $$;

-- prayer_times has a date PK, not id — dedicated trigger fn
create or replace function public.write_audit_prayer_times() returns trigger
language plpgsql security definer as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
begin
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, diff)
  values (
    nullif(claims ->> 'sub', '')::uuid,
    claims ->> 'email',
    lower(tg_op),
    'prayer_times',
    coalesce(new.date, old.date)::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
         when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
         else jsonb_build_object('old', to_jsonb(old)) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_prayer_times after insert or update or delete on public.prayer_times
  for each row execute function public.write_audit_prayer_times();
create trigger audit_events after insert or update or delete on public.events
  for each row execute function public.write_audit();
create trigger audit_news after insert or update or delete on public.news
  for each row execute function public.write_audit();
create trigger audit_banners after insert or update or delete on public.banners
  for each row execute function public.write_audit();
create trigger audit_notices after insert or update or delete on public.notices
  for each row execute function public.write_audit();
create trigger audit_donation_categories after insert or update or delete on public.donation_categories
  for each row execute function public.write_audit();
create trigger audit_madrasah_classes after insert or update or delete on public.madrasah_classes
  for each row execute function public.write_audit();
create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.write_audit();
create trigger audit_gallery_images after insert or update or delete on public.gallery_images
  for each row execute function public.write_audit();

-- app_config has text PK
create or replace function public.write_audit_app_config() returns trigger
language plpgsql security definer as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
begin
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, diff)
  values (
    nullif(claims ->> 'sub', '')::uuid,
    claims ->> 'email',
    lower(tg_op),
    'app_config',
    coalesce(new.key, old.key),
    case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
         when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
         else jsonb_build_object('old', to_jsonb(old)) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_app_config after insert or update or delete on public.app_config
  for each row execute function public.write_audit_app_config();

-- ============ RLS: default deny ============
alter table public.prayer_times enable row level security;
alter table public.jumuah_times enable row level security;
alter table public.events enable row level security;
alter table public.news enable row level security;
alter table public.banners enable row level security;
alter table public.notices enable row level security;
alter table public.donation_categories enable row level security;
alter table public.madrasah_classes enable row level security;
alter table public.services enable row level security;
alter table public.gallery_images enable row level security;
alter table public.app_config enable row level security;
alter table public.audit_log enable row level security;

-- Public (anon + authenticated) read policies, filtered to published/active content
create policy public_read_prayer_times on public.prayer_times
  for select using (true);
create policy public_read_jumuah on public.jumuah_times
  for select using (is_active);
create policy public_read_events on public.events
  for select using (is_published);
create policy public_read_news on public.news
  for select using (is_published);
create policy public_read_banners on public.banners
  for select using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );
create policy public_read_notices on public.notices
  for select using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );
create policy public_read_donation_categories on public.donation_categories
  for select using (is_active);
create policy public_read_madrasah on public.madrasah_classes
  for select using (is_active);
create policy public_read_services on public.services
  for select using (is_active);
create policy public_read_gallery on public.gallery_images
  for select using (is_published);
create policy public_read_config on public.app_config
  for select using (true);

-- Staff write policies (editor + admin can CRUD content; only admin touches config)
create policy staff_all_prayer_times on public.prayer_times
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_jumuah on public.jumuah_times
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_events on public.events
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_news on public.news
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_banners on public.banners
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_notices on public.notices
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_donation_categories on public.donation_categories
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_madrasah on public.madrasah_classes
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_services on public.services
  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_gallery on public.gallery_images
  for all using (public.is_staff()) with check (public.is_staff());
create policy admin_all_config on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_log: staff read-only; writes happen only via security-definer triggers
create policy staff_read_audit on public.audit_log
  for select using (public.is_staff());

-- ============ storage: public media bucket ============
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');
create policy media_staff_write on storage.objects
  for insert with check (bucket_id = 'media' and public.is_staff());
create policy media_staff_update on storage.objects
  for update using (bucket_id = 'media' and public.is_staff());
create policy media_staff_delete on storage.objects
  for delete using (bucket_id = 'media' and public.is_staff());
