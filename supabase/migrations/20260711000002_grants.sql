-- Table-level privileges (RLS remains the row-level gate on top).
-- anon: SELECT only — the mobile app is read-only by design (REBUILD_PLAN §6).
-- authenticated: full DML, but RLS staff/admin policies still decide row access.

grant usage on schema public to anon, authenticated;

grant select on
  public.prayer_times,
  public.jumuah_times,
  public.events,
  public.news,
  public.banners,
  public.notices,
  public.donation_categories,
  public.madrasah_classes,
  public.services,
  public.gallery_images,
  public.app_config
to anon, authenticated;

grant insert, update, delete on
  public.prayer_times,
  public.jumuah_times,
  public.events,
  public.news,
  public.banners,
  public.notices,
  public.donation_categories,
  public.madrasah_classes,
  public.services,
  public.gallery_images,
  public.app_config
to authenticated;

-- audit_log: staff (authenticated + role claim) read only; no anon access at all.
grant select on public.audit_log to authenticated;

-- helper functions used inside policies must be executable by API roles
grant execute on function public.jwt_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
