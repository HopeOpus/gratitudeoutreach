-- Realtime: postgres_changes filtered by edition_id (RLS is respected per subscriber).
alter publication supabase_realtime add table
  public.visits, public.service_records, public.visit_needs, public.inventory_items, public.flags,
  public.confidential_records, public.volunteer_sessions;
