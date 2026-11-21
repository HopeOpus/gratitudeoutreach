-- Gratitude Connect — core schema (see docs/DataModel.md)
-- Every table gets RLS enabled in 20261121000002_rls.sql (default deny).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;          -- RLS helpers / internal functions
grant usage on schema app to authenticated, anon, service_role;

-- ORGANISATION & ADMINS ------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  church_name text,
  consent_text text not null,
  consent_version int not null default 1,
  retention_months int not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.org_role as enum ('super_admin','coordinator','followup','viewer');
create table public.org_members (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.org_role not null,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.org_members (user_id);

-- EDITIONS & STATIONS ----------------------------------------------------------
create type public.edition_status as enum ('draft','live','closed');
create table public.editions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations,
  name text not null,
  code_prefix text not null check (code_prefix ~ '^[A-Z0-9]{2,6}$'),
  starts_on date not null,
  ends_on date not null,
  venue text,
  theme text,
  status public.edition_status not null default 'draft',
  is_training boolean not null default false,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index on public.editions (org_id, status);

create type public.station_kind as enum ('registration','prayer','counselling','medical','food','clothing','checkout','custom');
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions on delete cascade,
  kind public.station_kind not null,
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0,
  enabled boolean not null default true,
  is_service boolean not null default true,
  join_pin_hash text not null,               -- crypt(pin, gen_salt('bf'))
  role_pin_hash text,                        -- required for medical/counselling
  lead_pin_hash text,                        -- optional: grants station_lead + overrides (DECISIONS.md)
  form_schema jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.stations (edition_id, sort_order);

-- Encrypted copies of PINs so coordinators can print posters. Service-role only.
create table public.station_secrets (
  station_id uuid primary key references public.stations on delete cascade,
  join_pin_enc text,
  role_pin_enc text,
  lead_pin_enc text,
  updated_at timestamptz not null default now()
);

-- Signed join links: only the SHA-256 of the token is stored.
create table public.station_join_tokens (
  token_hash text primary key,
  station_id uuid not null references public.stations on delete cascade,
  expires_at timestamptz not null,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create type public.session_role as enum ('volunteer','station_lead');
create table public.volunteer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  edition_id uuid not null references public.editions,
  station_id uuid not null references public.stations,
  role public.session_role not null default 'volunteer',
  display_name text not null check (length(display_name) between 1 and 60),
  phone text,
  designation text,
  device_label text,
  confidential_ack_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  pending_ops int not null default 0,
  oldest_pending_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.volunteer_sessions (user_id) where revoked_at is null;
create index on public.volunteer_sessions (edition_id, station_id);

create table public.join_attempts (
  id bigserial primary key,
  user_id uuid,
  ip text,
  success boolean not null,
  at timestamptz not null default now()
);
create index on public.join_attempts (user_id, at);
create index on public.join_attempts (ip, at);

create table public.lead_overrides (       -- one-shot lead PIN approvals (food duplicate guard etc.)
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations on delete cascade,
  session_id uuid not null references public.volunteer_sessions,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- CARDS ------------------------------------------------------------------------
create type public.card_status as enum ('unassigned','assigned','void');
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions on delete cascade,
  code text not null,
  batch_no int not null,
  status public.card_status not null default 'unassigned',
  visit_id uuid,
  voided_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, code)
);
create index on public.cards (edition_id, batch_no);

create table public.code_blocks (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions on delete cascade,
  session_id uuid references public.volunteer_sessions,
  block_no int not null,
  prefix text not null,                      -- e.g. GO26-R3
  range_start int not null,
  range_end int not null,
  next_value int not null,
  created_at timestamptz not null default now(),
  unique (edition_id, block_no)
);

-- PEOPLE -----------------------------------------------------------------------
create type public.age_range as enum ('0-12','13-17','18-35','36-59','60+');
create type public.gender as enum ('female','male','undisclosed');
create table public.beneficiaries (
  id uuid primary key,                       -- client uuidv7
  org_id uuid not null references public.organizations,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  full_name_search text generated always as (lower(full_name)) stored,
  phone text check (phone is null or phone ~ '^\+234[0-9]{10}$'),
  phone_last4 text generated always as (right(phone, 4)) stored,
  gender public.gender,
  age_range public.age_range,
  community text,
  language text,
  church_member text check (church_member in ('yes','no','visitor')),
  guardian_beneficiary_id uuid references public.beneficiaries,
  guardian_name text,
  merged_into uuid references public.beneficiaries,
  field_updated_at jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.beneficiaries using gin (full_name_search extensions.gin_trgm_ops);
create index on public.beneficiaries (phone);
create index on public.beneficiaries (phone_last4);
create index on public.beneficiaries (org_id);

create type public.visit_status as enum ('active','checked_out');
create table public.visits (
  id uuid primary key,                       -- client uuidv7
  edition_id uuid not null references public.editions,
  beneficiary_id uuid not null references public.beneficiaries,
  card_code text,
  household_size int check (household_size is null or household_size between 1 and 50),
  status public.visit_status not null default 'active',
  registered_by_session uuid references public.volunteer_sessions,
  registered_by_name text,
  registered_at timestamptz not null,
  checked_out_at timestamptz,
  consent_data_at timestamptz not null,
  consent_followup_at timestamptz,
  consent_version int not null,
  client_updated_at timestamptz,
  field_updated_at jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (edition_id, beneficiary_id),
  unique (edition_id, card_code)
);
create index on public.visits (edition_id, updated_at);
create index on public.visits (beneficiary_id);

create type public.need_state as enum ('pending','served','declined','referred');
create table public.visit_needs (
  visit_id uuid not null references public.visits on delete cascade,
  station_id uuid not null references public.stations,
  edition_id uuid not null references public.editions,   -- denormalised for realtime filter
  state public.need_state not null default 'pending',
  source text not null default 'registration',
  state_at timestamptz not null default now(),
  declined_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (visit_id, station_id)
);
create index on public.visit_needs (edition_id, station_id, state);
create index on public.visit_needs (edition_id, updated_at);

-- SERVICES ---------------------------------------------------------------------
create table public.service_records (       -- APPEND-ONLY (void via voided_at)
  id uuid primary key,
  edition_id uuid not null references public.editions,
  visit_id uuid not null references public.visits,
  station_id uuid not null references public.stations,
  session_id uuid not null references public.volunteer_sessions,
  served_by_name text not null,
  summary text not null check (length(summary) <= 140),
  data jsonb not null default '{}',
  has_confidential boolean not null default false,
  served_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index on public.service_records (visit_id, served_at);
create index on public.service_records (edition_id, station_id, served_at);
create index on public.service_records (edition_id, updated_at);

create type public.confidential_kind as enum ('medical','counselling');
create table public.confidential_records (
  service_record_id uuid primary key references public.service_records on delete cascade,
  edition_id uuid not null references public.editions,
  visit_id uuid not null references public.visits,
  kind public.confidential_kind not null,
  payload jsonb not null,
  redacted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.confidential_records (visit_id);

create table public.break_glass_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind public.confidential_kind not null,
  visit_id uuid not null references public.visits,
  reason text not null check (length(trim(reason)) >= 10),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.break_glass_grants (user_id, visit_id);

create type public.flag_scope as enum ('all','medical','counselling','leads');
create table public.flags (
  id uuid primary key,
  edition_id uuid not null references public.editions,  -- denormalised for realtime filter
  visit_id uuid not null references public.visits,
  kind text not null,
  scope public.flag_scope not null default 'all',
  text text not null check (length(text) <= 200),
  created_by_session uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.flags (visit_id);
create index on public.flags (edition_id, updated_at);

-- INVENTORY --------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions on delete cascade,
  station_id uuid not null references public.stations on delete cascade,
  name text not null,
  unit text not null default 'pcs',
  sizes text[],
  opening_qty int not null default 0 check (opening_qty >= 0),
  remaining int not null default 0,
  low_threshold int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.inventory_items (edition_id, station_id);

create table public.inventory_movements (    -- APPEND-ONLY
  id uuid primary key,
  item_id uuid not null references public.inventory_items on delete cascade,
  delta int not null,
  reason text not null check (reason in ('opening','service','restock','damage','correction','void')),
  service_record_id uuid references public.service_records,
  session_or_user uuid,
  created_at timestamptz not null default now()
);
create index on public.inventory_movements (item_id);
create unique index inventory_movements_service_item on public.inventory_movements (service_record_id, item_id, reason)
  where service_record_id is not null;

-- FOLLOW-UP --------------------------------------------------------------------
create type public.followup_type as enum ('salvation','rededication','prayer','counselling','counselling_urgent','medical_referral','fellowship');
create type public.followup_status as enum ('new','assigned','contacted','completed','unreachable');
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions,
  visit_id uuid not null references public.visits,
  type public.followup_type not null,
  status public.followup_status not null default 'new',
  assignee_user_id uuid references auth.users,
  source_service_record_id uuid references public.service_records,
  preferred_time text,
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_service_record_id, type)
);
create index on public.followups (edition_id, status);

create table public.followup_events (
  id uuid primary key default gen_random_uuid(),
  followup_id uuid not null references public.followups on delete cascade,
  outcome text not null check (outcome in ('reached','no_answer','wrong_number','visited','note')),
  note text,
  by_user uuid references auth.users,
  created_at timestamptz not null default now()
);
create index on public.followup_events (followup_id);

-- AUDIT ------------------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_user uuid,
  actor_session uuid,
  action text not null,
  table_name text,
  row_id uuid,
  before jsonb,
  after jsonb,
  meta jsonb
);
create index on public.audit_log (at desc);
create index on public.audit_log (table_name, row_id);
