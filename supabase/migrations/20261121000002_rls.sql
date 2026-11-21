-- Row Level Security: helpers + policies. Default deny on EVERY table.
-- Matrix: docs/DataModel.md §4. Tests: supabase/tests/*.sql

-- ---------------------------------------------------------------------------
-- Helper functions (STABLE SECURITY DEFINER, empty search_path)
-- ---------------------------------------------------------------------------
create or replace function app.active_session()
returns public.volunteer_sessions
language sql stable security definer set search_path = '' as $$
  select s.* from public.volunteer_sessions s
  where s.user_id = auth.uid() and s.revoked_at is null and s.expires_at > now()
  order by s.created_at desc
  limit 1
$$;

create or replace function app.session_id() returns uuid
language sql stable security definer set search_path = '' as $$ select (app.active_session()).id $$;

create or replace function app.session_edition() returns uuid
language sql stable security definer set search_path = '' as $$ select (app.active_session()).edition_id $$;

create or replace function app.session_station() returns uuid
language sql stable security definer set search_path = '' as $$ select (app.active_session()).station_id $$;

create or replace function app.session_kind() returns public.station_kind
language sql stable security definer set search_path = '' as $$
  select st.kind from public.stations st where st.id = (app.active_session()).station_id
$$;

create or replace function app.session_is_lead() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((app.active_session()).role = 'station_lead', false)
$$;

create or replace function app.session_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select e.org_id from public.editions e where e.id = (app.active_session()).edition_id
$$;

create or replace function app.is_org_member(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  )
$$;

create or replace function app.is_any_org_role(p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.org_members m where m.user_id = auth.uid() and m.role = any (p_roles))
$$;

create or replace function app.is_edition_role(p_edition uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members m
    join public.editions e on e.org_id = m.org_id
    where e.id = p_edition and m.user_id = auth.uid() and m.role = any (p_roles)
  )
$$;

create or replace function app.can_access_edition(p_edition uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_edition_role(p_edition, '{super_admin,coordinator,followup,viewer}')
      or app.session_edition() = p_edition
$$;

-- Confidential: session at that station kind in the visit's edition, or a live break-glass grant.
create or replace function app.has_confidential(p_kind public.confidential_kind, p_visit uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (
      app.session_kind()::text = p_kind::text
      and exists (select 1 from public.visits v where v.id = p_visit and v.edition_id = app.session_edition())
    )
    or exists (
      select 1 from public.break_glass_grants g
      where g.user_id = auth.uid() and g.visit_id = p_visit and g.kind = p_kind and g.expires_at > now()
    )
$$;

grant execute on all functions in schema app to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (default deny)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','org_members','editions','stations','station_secrets','station_join_tokens',
    'volunteer_sessions','join_attempts','lead_overrides','cards','code_blocks','beneficiaries','visits',
    'visit_needs','service_records','confidential_records','break_glass_grants','flags','inventory_items',
    'inventory_movements','followups','followup_events','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Secrets/internal tables: no policies, and no grants for client roles.
revoke all on public.station_secrets, public.station_join_tokens, public.join_attempts, public.lead_overrides
  from authenticated;

-- Stations: hide PIN hashes via column privileges (+ stations_public view).
revoke all on public.stations from authenticated;
grant select (id, edition_id, kind, name, icon, color, sort_order, enabled, is_service, form_schema, created_at, updated_at)
  on public.stations to authenticated;
grant update (name, icon, color, sort_order, enabled, is_service, form_schema)
  on public.stations to authenticated;
grant delete on public.stations to authenticated;

-- Append-only / RPC-managed tables: clients may not update/delete directly.
revoke update, delete on public.service_records, public.inventory_movements, public.audit_log,
  public.confidential_records, public.volunteer_sessions, public.cards, public.code_blocks,
  public.break_glass_grants from authenticated;
revoke insert on public.volunteer_sessions, public.cards, public.code_blocks, public.audit_log,
  public.break_glass_grants, public.inventory_movements from authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- organizations
create policy org_select on public.organizations for select to authenticated
  using (app.is_org_member(id, '{super_admin,coordinator,followup,viewer}') or id = (select app.session_org()));
create policy org_update on public.organizations for update to authenticated
  using (app.is_org_member(id, '{super_admin}')) with check (app.is_org_member(id, '{super_admin}'));

-- org_members
create policy members_select on public.org_members for select to authenticated
  using (user_id = auth.uid() or app.is_org_member(org_id, '{super_admin,coordinator}'));
create policy members_insert on public.org_members for insert to authenticated
  with check (app.is_org_member(org_id, '{super_admin}'));
create policy members_update on public.org_members for update to authenticated
  using (app.is_org_member(org_id, '{super_admin}')) with check (app.is_org_member(org_id, '{super_admin}'));
create policy members_delete on public.org_members for delete to authenticated
  using (app.is_org_member(org_id, '{super_admin}') and user_id <> auth.uid());

-- editions
create policy editions_select on public.editions for select to authenticated
  using (app.is_org_member(org_id, '{super_admin,coordinator,followup,viewer}') or id = (select app.session_edition()));
create policy editions_insert on public.editions for insert to authenticated
  with check (app.is_org_member(org_id, '{super_admin,coordinator}'));
create policy editions_update on public.editions for update to authenticated
  using (app.is_org_member(org_id, '{super_admin,coordinator}'))
  with check (app.is_org_member(org_id, '{super_admin,coordinator}'));

-- stations
create policy stations_select on public.stations for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,followup,viewer}') or edition_id = (select app.session_edition()));
create policy stations_update on public.stations for update to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'))
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));
create policy stations_delete on public.stations for delete to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'));

create view public.stations_public with (security_invoker = true) as
  select id, edition_id, kind, name, icon, color, sort_order, enabled, is_service, form_schema, created_at, updated_at
  from public.stations;
grant select on public.stations_public to authenticated;

-- volunteer_sessions (writes via RPC only)
create policy sessions_select on public.volunteer_sessions for select to authenticated
  using (user_id = auth.uid() or app.is_edition_role(edition_id, '{super_admin,coordinator}'));

-- cards (writes via RPC only)
create policy cards_select on public.cards for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}') or edition_id = (select app.session_edition()));

-- code_blocks
create policy code_blocks_select on public.code_blocks for select to authenticated
  using (session_id = (select app.session_id()) or app.is_edition_role(edition_id, '{super_admin,coordinator}'));

-- beneficiaries
create policy beneficiaries_select on public.beneficiaries for select to authenticated
  using (
    app.is_org_member(org_id, '{super_admin,coordinator}')
    or exists (select 1 from public.visits v
               where v.beneficiary_id = beneficiaries.id and v.edition_id = (select app.session_edition()))
    or (app.is_org_member(org_id, '{followup}')
        and exists (select 1 from public.visits v
                    where v.beneficiary_id = beneficiaries.id and v.consent_followup_at is not null))
  );
create policy beneficiaries_insert on public.beneficiaries for insert to authenticated
  with check (
    app.is_org_member(org_id, '{super_admin,coordinator}')
    or ((select app.session_kind()) = 'registration' and org_id = (select app.session_org()))
  );
create policy beneficiaries_update on public.beneficiaries for update to authenticated
  using (app.is_org_member(org_id, '{super_admin,coordinator}'))
  with check (app.is_org_member(org_id, '{super_admin,coordinator}'));

-- visits
create policy visits_select on public.visits for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,followup}') or edition_id = (select app.session_edition()));
create policy visits_insert on public.visits for insert to authenticated
  with check (
    app.is_edition_role(edition_id, '{super_admin,coordinator}')
    or ((select app.session_kind()) = 'registration'
        and edition_id = (select app.session_edition())
        and registered_by_session = (select app.session_id()))
  );
create policy visits_update on public.visits for update to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'))
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));

-- visit_needs
create policy needs_select on public.visit_needs for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,followup}') or edition_id = (select app.session_edition()));
create policy needs_insert on public.visit_needs for insert to authenticated
  with check (
    (app.is_edition_role(edition_id, '{super_admin,coordinator}') or edition_id = (select app.session_edition()))
    and exists (select 1 from public.visits v where v.id = visit_id and v.edition_id = visit_needs.edition_id)
    and exists (select 1 from public.stations s where s.id = station_id and s.edition_id = visit_needs.edition_id)
  );
create policy needs_update on public.visit_needs for update to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'))
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));

-- service_records: read all in edition; insert for OWN station only
create policy services_select on public.service_records for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,followup}') or edition_id = (select app.session_edition()));
create policy services_insert on public.service_records for insert to authenticated
  with check (
    edition_id = (select app.session_edition())
    and station_id = (select app.session_station())
    and session_id = (select app.session_id())
    and exists (select 1 from public.visits v where v.id = visit_id and v.edition_id = service_records.edition_id)
  );

-- confidential_records: ONLY the matching station kind (or break-glass)
create policy confidential_select on public.confidential_records for select to authenticated
  using (app.has_confidential(kind, visit_id));
create policy confidential_insert on public.confidential_records for insert to authenticated
  with check (
    (select app.session_kind())::text = kind::text
    and edition_id = (select app.session_edition())
    and exists (select 1 from public.service_records sr
                where sr.id = service_record_id and sr.session_id = (select app.session_id())
                  and sr.visit_id = confidential_records.visit_id)
  );

-- break_glass_grants
create policy break_glass_select on public.break_glass_grants for select to authenticated
  using (user_id = auth.uid() or app.is_any_org_role('{super_admin}'));

-- flags
create policy flags_select on public.flags for select to authenticated
  using (
    app.is_edition_role(edition_id, '{super_admin,coordinator,followup}')
    or (edition_id = (select app.session_edition())
        and (scope = 'all'
             or scope::text = (select app.session_kind())::text
             or (scope = 'leads' and (select app.session_is_lead()))))
  );
create policy flags_insert on public.flags for insert to authenticated
  with check (
    edition_id = (select app.session_edition())
    and created_by_session = (select app.session_id())
    and (scope in ('all','leads') or scope::text = (select app.session_kind())::text)
    and exists (select 1 from public.visits v where v.id = visit_id and v.edition_id = flags.edition_id)
  );
create policy flags_update on public.flags for update to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'))
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));

-- inventory_items
create policy inventory_select on public.inventory_items for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,viewer}') or edition_id = (select app.session_edition()));
create policy inventory_insert on public.inventory_items for insert to authenticated
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));
create policy inventory_update on public.inventory_items for update to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'))
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));
create policy inventory_delete on public.inventory_items for delete to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'));

create policy movements_select on public.inventory_movements for select to authenticated
  using (exists (
    select 1 from public.inventory_items i where i.id = item_id
      and (app.is_edition_role(i.edition_id, '{super_admin,coordinator}')
           or (i.station_id = (select app.session_station()) and (select app.session_is_lead())))
  ));

-- followups (admins only; never volunteer sessions)
create policy followups_select on public.followups for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,followup}'));
create policy followups_insert on public.followups for insert to authenticated
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator}'));
create policy followups_update on public.followups for update to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator,followup}'))
  with check (app.is_edition_role(edition_id, '{super_admin,coordinator,followup}'));

create policy followup_events_select on public.followup_events for select to authenticated
  using (exists (select 1 from public.followups f where f.id = followup_id
                 and app.is_edition_role(f.edition_id, '{super_admin,coordinator,followup}')));
create policy followup_events_insert on public.followup_events for insert to authenticated
  with check (by_user = auth.uid() and exists (
    select 1 from public.followups f where f.id = followup_id
      and app.is_edition_role(f.edition_id, '{super_admin,coordinator,followup}')));

-- audit_log: super admins only
create policy audit_select on public.audit_log for select to authenticated
  using (app.is_any_org_role('{super_admin}'));
