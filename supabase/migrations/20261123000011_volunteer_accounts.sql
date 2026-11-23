-- Volunteer accounts (see DECISIONS.md 2026-11-23).
--
-- Before: every phone joined with the station PIN, a first name and an optional
-- phone number. Nothing linked two phones used by the same person.
--
-- Now:
--   * Register: station PIN (or join QR) + name + phone number (required).
--     This creates a volunteer_accounts row for that station and edition.
--   * Sign in: name + phone number. The phone number works as the password.
--     Any number of devices can sign in to the same account at the same time.
--   * Confidential stations (Medical, Pharmacy, Counselling) still need the
--     role PIN and the confidentiality agreement on every device. A phone
--     number is not a secret, so it alone must not open medical notes.
--   * The lead PIN stays per device too: signing in never makes someone a lead.

create table public.volunteer_accounts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions on delete cascade,
  station_id uuid not null references public.stations,
  display_name text not null check (length(display_name) between 1 and 60),
  phone text not null check (phone ~ '^\+234[0-9]{10}$'),
  designation text,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, phone)
);
create index on public.volunteer_accounts (station_id);

alter table public.volunteer_sessions add column account_id uuid references public.volunteer_accounts on delete set null;
create index on public.volunteer_sessions (account_id) where revoked_at is null;

-- RLS: coordinators read; all writes go through the RPCs below.
alter table public.volunteer_accounts enable row level security;
revoke all on public.volunteer_accounts from anon;
revoke insert, update, delete on public.volunteer_accounts from authenticated;
create policy accounts_select on public.volunteer_accounts for select to authenticated
  using (app.is_edition_role(edition_id, '{super_admin,coordinator}'));

create trigger volunteer_accounts_updated_at before update on public.volunteer_accounts
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Internals
-- ---------------------------------------------------------------------------
-- Same name rules on both sides: case-insensitive, extra spaces ignored.
create or replace function app.name_key(p text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

-- Role PIN + agreement check. Returns an {error} object, or null when OK.
create or replace function app.session_gate(
  p_uid uuid, p_ip text, p_station public.stations, p_role_pin text, p_confidential_ack boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_confidential boolean := app.is_confidential_kind(p_station.kind);
  v_is_lead boolean := app.pin_matches(p_role_pin, p_station.lead_pin_hash);
  v_role_ok boolean := v_is_lead or app.pin_matches(p_role_pin, p_station.role_pin_hash);
begin
  if (v_confidential and not v_role_ok)
     or (not v_confidential and nullif(p_role_pin, '') is not null and not v_is_lead) then
    insert into public.join_attempts (user_id, ip, success) values (p_uid, p_ip, false);
    return jsonb_build_object('error', 'invalid_role_pin', 'needs_role_pin', v_confidential);
  end if;
  if v_confidential and not coalesce(p_confidential_ack, false) then
    return jsonb_build_object('error', 'confidential_ack_required', 'needs_role_pin', true);
  end if;
  return null;
end $$;

create or replace function app.session_expiry(p_edition public.editions) returns timestamptz
language sql stable set search_path = '' as $$
  select case
    when p_edition.is_training then now() + interval '12 hours'
    else ((p_edition.ends_on + 1)::timestamp at time zone 'Africa/Lagos') + interval '6 hours'
  end
$$;

-- Opens a session on THIS device for an account. Other devices on the same
-- account keep their sessions. Call app.session_gate first.
create or replace function app.open_session(
  p_uid uuid, p_ip text, p_account public.volunteer_accounts, p_station public.stations,
  p_role_pin text, p_device_label text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition public.editions;
  v_org public.organizations;
  v_is_lead boolean := app.pin_matches(p_role_pin, p_station.lead_pin_hash);
  v_session public.volunteer_sessions;
begin
  select * into v_edition from public.editions where id = p_station.edition_id;
  select * into v_org from public.organizations where id = v_edition.org_id;

  update public.volunteer_sessions set revoked_at = now()
  where user_id = p_uid and revoked_at is null;

  insert into public.volunteer_sessions (user_id, edition_id, station_id, account_id, role, display_name, phone,
    designation, device_label, confidential_ack_at, expires_at, last_seen_at)
  values (p_uid, v_edition.id, p_station.id, p_account.id,
    case when v_is_lead then 'station_lead'::public.session_role else 'volunteer'::public.session_role end,
    p_account.display_name, p_account.phone, p_account.designation, left(p_device_label, 60),
    case when app.is_confidential_kind(p_station.kind) then now() end, app.session_expiry(v_edition), now())
  returning * into v_session;

  insert into public.join_attempts (user_id, ip, success) values (p_uid, p_ip, true);

  return jsonb_build_object(
    'session', jsonb_build_object('id', v_session.id, 'role', v_session.role, 'display_name', v_session.display_name,
      'designation', v_session.designation, 'expires_at', v_session.expires_at, 'station_id', v_session.station_id,
      'edition_id', v_session.edition_id),
    'station', app.station_json(p_station),
    'edition', jsonb_build_object('id', v_edition.id, 'name', v_edition.name, 'code_prefix', v_edition.code_prefix,
      'status', v_edition.status, 'is_training', v_edition.is_training, 'starts_on', v_edition.starts_on,
      'ends_on', v_edition.ends_on, 'org_id', v_edition.org_id),
    'org', jsonb_build_object('name', v_org.name, 'church_name', v_org.church_name,
      'consent_text', v_org.consent_text, 'consent_version', v_org.consent_version)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Register (called by join_station / join_station_token once a name is given)
-- ---------------------------------------------------------------------------
create or replace function app.create_session(
  p_uid uuid, p_ip text, p_station public.stations, p_name text, p_phone text,
  p_role_pin text, p_designation text, p_device_label text, p_confidential_ack boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition public.editions;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_gate jsonb;
  v_existing public.volunteer_accounts;
  v_account public.volunteer_accounts;
begin
  if length(v_name) < 1 or length(v_name) > 60 then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_phone is null then
    return jsonb_build_object('error', 'phone_required');
  end if;
  if p_phone !~ '^\+234[0-9]{10}$' then
    return jsonb_build_object('error', 'invalid_phone');
  end if;

  select * into v_existing from public.volunteer_accounts
  where edition_id = p_station.edition_id and phone = p_phone;
  if found then
    return jsonb_build_object('error', 'already_registered');
  end if;

  v_gate := app.session_gate(p_uid, p_ip, p_station, p_role_pin, p_confidential_ack);
  if v_gate is not null then return v_gate; end if;

  select * into v_edition from public.editions where id = p_station.edition_id;
  if app.session_expiry(v_edition) <= now() then
    return jsonb_build_object('error', 'edition_ended');
  end if;

  insert into public.volunteer_accounts (edition_id, station_id, display_name, phone, designation)
  values (p_station.edition_id, p_station.id, v_name, p_phone, nullif(trim(coalesce(p_designation, '')), ''))
  on conflict (edition_id, phone) do nothing
  returning * into v_account;
  if v_account.id is null then
    return jsonb_build_object('error', 'already_registered');
  end if;

  return app.open_session(p_uid, p_ip, v_account, p_station, p_role_pin, p_device_label);
end $$;

-- ---------------------------------------------------------------------------
-- Sign in: name + phone. Two steps like joining: on a confidential station,
-- without a role PIN and the agreement it answers {ok, station, needs_role_pin}
-- so the phone can ask for them, then the phone calls again.
-- ---------------------------------------------------------------------------
create or replace function public.sign_in_volunteer(
  p_name text, p_phone text, p_role_pin text default null, p_device_label text default null,
  p_confidential_ack boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ip text := app.request_ip();
  v_account public.volunteer_accounts;
  v_station public.stations;
  v_edition public.editions;
  v_gate jsonb;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if app.join_locked(v_uid, v_ip) then
    return jsonb_build_object('error', 'locked', 'retry_after_seconds', 300);
  end if;

  -- Newest live edition first (a training edition may be live alongside the real one).
  select a.* into v_account
  from public.volunteer_accounts a
  join public.editions e on e.id = a.edition_id
  where a.phone = p_phone and a.disabled_at is null and e.status = 'live'
    and app.name_key(a.display_name) = app.name_key(p_name)
  order by e.is_training, e.starts_on desc
  limit 1;

  if not found then
    insert into public.join_attempts (user_id, ip, success) values (v_uid, v_ip, false);
    return jsonb_build_object('error', 'account_not_found');
  end if;

  select * into v_station from public.stations where id = v_account.station_id;
  if not v_station.enabled then
    return jsonb_build_object('error', 'station_closed');
  end if;
  select * into v_edition from public.editions where id = v_account.edition_id;
  if app.session_expiry(v_edition) <= now() then
    return jsonb_build_object('error', 'edition_ended');
  end if;

  if app.is_confidential_kind(v_station.kind)
     and (nullif(p_role_pin, '') is null or not coalesce(p_confidential_ack, false)) then
    return jsonb_build_object('ok', true, 'station', app.station_json(v_station), 'needs_role_pin', true,
      'display_name', v_account.display_name);
  end if;

  v_gate := app.session_gate(v_uid, v_ip, v_station, p_role_pin, p_confidential_ack);
  if v_gate is not null then return v_gate; end if;

  return app.open_session(v_uid, v_ip, v_account, v_station, p_role_pin, p_device_label);
end $$;

grant execute on function public.sign_in_volunteer(text, text, text, text, boolean) to authenticated;
revoke execute on function public.sign_in_volunteer(text, text, text, text, boolean) from anon, public;

-- ---------------------------------------------------------------------------
-- Moving a volunteer moves their account, so every device and every later
-- sign-in follows. Ending a session still ends just that device.
-- ---------------------------------------------------------------------------
create or replace function public.move_session(p_session uuid, p_station uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.volunteer_sessions;
begin
  select * into s from public.volunteer_sessions where id = p_session;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_role(s.edition_id, '{super_admin,coordinator}');
  if not exists (select 1 from public.stations where id = p_station and edition_id = s.edition_id) then
    raise exception 'invalid_station' using errcode = '22023';
  end if;
  if s.account_id is not null then
    update public.volunteer_accounts set station_id = p_station where id = s.account_id;
    update public.volunteer_sessions set station_id = p_station, role = 'volunteer'
    where account_id = s.account_id and revoked_at is null;
  else
    update public.volunteer_sessions set station_id = p_station, role = 'volunteer' where id = p_session;
  end if;
  insert into public.audit_log (actor_user, action, table_name, row_id, meta)
  values (auth.uid(), 'move_session', 'volunteer_sessions', p_session, jsonb_build_object('to_station', p_station));
end $$;
