-- 1. Pharmacy station: reads Medical's prescriptions (medical confidential
--    records), joins with a role PIN like Medical, dispenses from stock.
-- 2. Prayer and Counselling are one station by default ("Prayer & Counselling").
--    The confidential Counselling station kind still exists, switched off.
-- 3. One code sequence per edition (GO26-0001, GO26-0002, ...) shared by
--    pre-printed cards and the QR slips phones print, so people only need
--    to remember the number.

-- ---------------------------------------------------------------------------
-- Confidential station kinds
-- ---------------------------------------------------------------------------
create or replace function app.is_confidential_kind(p_kind public.station_kind) returns boolean
language sql immutable set search_path = '' as $$
  select p_kind::text in ('medical','counselling','pharmacy')
$$;

-- Medical notes are readable by Medical and by Pharmacy (to see prescriptions).
create or replace function app.has_confidential(p_kind public.confidential_kind, p_visit uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (
      (app.session_kind()::text = p_kind::text
       or (p_kind = 'medical' and app.session_kind()::text = 'pharmacy'))
      and exists (select 1 from public.visits v where v.id = p_visit and v.edition_id = app.session_edition())
    )
    or exists (
      select 1 from public.break_glass_grants g
      where g.user_id = auth.uid() and g.visit_id = p_visit and g.kind = p_kind and g.expires_at > now()
    )
$$;

create or replace function app.create_session(
  p_uid uuid, p_ip text, p_station public.stations, p_name text, p_phone text,
  p_role_pin text, p_designation text, p_device_label text, p_confidential_ack boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition public.editions;
  v_org public.organizations;
  v_confidential boolean := app.is_confidential_kind(p_station.kind);
  v_is_lead boolean := app.pin_matches(p_role_pin, p_station.lead_pin_hash);
  v_role_ok boolean;
  v_session public.volunteer_sessions;
  v_expires timestamptz;
  v_name text := trim(coalesce(p_name, ''));
begin
  if length(v_name) < 1 or length(v_name) > 60 then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_phone is not null and p_phone !~ '^\+234[0-9]{10}$' then
    return jsonb_build_object('error', 'invalid_phone');
  end if;

  v_role_ok := v_is_lead or app.pin_matches(p_role_pin, p_station.role_pin_hash);
  if (v_confidential and not v_role_ok)
     or (not v_confidential and nullif(p_role_pin, '') is not null and not v_is_lead) then
    insert into public.join_attempts (user_id, ip, success) values (p_uid, p_ip, false);
    return jsonb_build_object('error', 'invalid_role_pin', 'needs_role_pin', v_confidential);
  end if;
  if v_confidential and not coalesce(p_confidential_ack, false) then
    return jsonb_build_object('error', 'confidential_ack_required', 'needs_role_pin', true);
  end if;

  select * into v_edition from public.editions where id = p_station.edition_id;
  select * into v_org from public.organizations where id = v_edition.org_id;

  v_expires := case
    when v_edition.is_training then now() + interval '12 hours'
    else ((v_edition.ends_on + 1)::timestamp at time zone 'Africa/Lagos') + interval '6 hours'
  end;
  if v_expires <= now() then
    return jsonb_build_object('error', 'edition_ended');
  end if;

  update public.volunteer_sessions set revoked_at = now()
  where user_id = p_uid and revoked_at is null;

  insert into public.volunteer_sessions (user_id, edition_id, station_id, role, display_name, phone,
    designation, device_label, confidential_ack_at, expires_at, last_seen_at)
  values (p_uid, v_edition.id, p_station.id, case when v_is_lead then 'station_lead'::public.session_role else 'volunteer'::public.session_role end,
    v_name, p_phone, nullif(trim(coalesce(p_designation, '')), ''), left(p_device_label, 60),
    case when v_confidential then now() end, v_expires, now())
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

create or replace function public.join_station(
  p_pin text, p_name text, p_phone text default null, p_role_pin text default null,
  p_designation text default null, p_device_label text default null, p_confidential_ack boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ip text := app.request_ip();
  v_station public.stations;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if app.join_locked(v_uid, v_ip) then
    return jsonb_build_object('error', 'locked', 'retry_after_seconds', 300);
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6}$' then
    insert into public.join_attempts (user_id, ip, success) values (v_uid, v_ip, false);
    return jsonb_build_object('error', 'invalid_pin');
  end if;

  select s.* into v_station
  from public.stations s join public.editions e on e.id = s.edition_id
  where e.status = 'live' and s.enabled and app.pin_matches(p_pin, s.join_pin_hash)
  limit 1;

  if not found then
    insert into public.join_attempts (user_id, ip, success) values (v_uid, v_ip, false);
    return jsonb_build_object('error', 'invalid_pin');
  end if;

  -- Step 1 of the join flow only checks the PIN and reports what the station needs.
  if p_name is null then
    return jsonb_build_object('ok', true, 'station', app.station_json(v_station),
      'needs_role_pin', app.is_confidential_kind(v_station.kind));
  end if;

  return app.create_session(v_uid, v_ip, v_station, p_name, p_phone, p_role_pin, p_designation,
    p_device_label, p_confidential_ack);
end $$;

create or replace function public.join_station_token(
  p_token text, p_name text, p_phone text default null, p_role_pin text default null,
  p_designation text default null, p_device_label text default null, p_confidential_ack boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ip text := app.request_ip();
  v_station public.stations;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if app.join_locked(v_uid, v_ip) then
    return jsonb_build_object('error', 'locked', 'retry_after_seconds', 300);
  end if;

  select s.* into v_station
  from public.station_join_tokens t
  join public.stations s on s.id = t.station_id
  join public.editions e on e.id = s.edition_id
  where t.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and t.expires_at > now() and e.status = 'live' and s.enabled;

  if not found then
    insert into public.join_attempts (user_id, ip, success) values (v_uid, v_ip, false);
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if p_name is null then
    return jsonb_build_object('ok', true, 'station', app.station_json(v_station),
      'needs_role_pin', app.is_confidential_kind(v_station.kind));
  end if;

  return app.create_session(v_uid, v_ip, v_station, p_name, p_phone, p_role_pin, p_designation,
    p_device_label, p_confidential_ack);
end $$;

-- ---------------------------------------------------------------------------
-- One code sequence per edition
-- ---------------------------------------------------------------------------
-- Next free number after every pre-printed card and every block handed to a
-- phone. Callers hold the per-edition lock until their transaction ends.
create or replace function app.claim_code_numbers(p_edition uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_prefix text; v_next int;
begin
  perform pg_advisory_xact_lock(hashtext('codes:' || p_edition::text));
  select code_prefix into v_prefix from public.editions where id = p_edition;
  select greatest(
    coalesce((select max(substring(code from '-(\d+)$')::int) from public.cards
              where edition_id = p_edition and code ~ ('^' || v_prefix || '-\d+$')), 0),
    coalesce((select max(range_end) from public.code_blocks where edition_id = p_edition and prefix = v_prefix), 0)
  ) + 1 into v_next;
  return v_next;
end $$;

create or replace function public.generate_cards(p_edition uuid, p_count int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_batch int;
  v_start int;
  v_width int;
begin
  perform app.require_role(p_edition, '{super_admin,coordinator}');
  if p_count is null or p_count < 1 or p_count > 5000 then
    raise exception 'count_out_of_range' using errcode = '22023', hint = 'Between 1 and 5,000 cards per batch.';
  end if;
  select code_prefix into v_prefix from public.editions where id = p_edition;
  select coalesce(max(batch_no), 0) + 1 into v_batch from public.cards where edition_id = p_edition;
  v_start := app.claim_code_numbers(p_edition);
  v_width := greatest(4, length((v_start + p_count - 1)::text));

  insert into public.cards (edition_id, code, batch_no)
  select p_edition, v_prefix || '-' || lpad(n::text, v_width, '0'), v_batch
  from generate_series(v_start, v_start + p_count - 1) n;

  return jsonb_build_object('batch_no', v_batch, 'count', p_count,
    'first', v_prefix || '-' || lpad(v_start::text, v_width, '0'),
    'last', v_prefix || '-' || lpad((v_start + p_count - 1)::text, v_width, '0'));
end $$;

-- Phones get blocks of plain numbers (GO26-0401 ... GO26-0600), refilled in the
-- background. p_new allocates a fresh block while the current one has codes left.
create or replace function public.reserve_code_block(p_size int default 200, p_new boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition uuid := app.session_edition();
  v_prefix text;
  v_block int;
  v_start int;
  v_size int := least(greatest(coalesce(p_size, 200), 10), 999);
  v_row public.code_blocks;
begin
  if v_edition is null or app.session_kind() <> 'registration' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select code_prefix into v_prefix from public.editions where id = v_edition;
  if not coalesce(p_new, false) then
    select * into v_row from public.code_blocks
    where session_id = app.session_id() and prefix = v_prefix and next_value <= range_end limit 1;
    if found then return to_jsonb(v_row); end if;
  elsif (select count(*) from public.code_blocks where session_id = app.session_id()) >= 20 then
    raise exception 'too_many_blocks' using errcode = '54000';
  end if;

  v_start := app.claim_code_numbers(v_edition);
  if v_start + v_size - 1 > 99999 then
    raise exception 'no_codes_left' using errcode = '54000';
  end if;
  select coalesce(max(block_no), 0) + 1 into v_block from public.code_blocks where edition_id = v_edition;
  insert into public.code_blocks (edition_id, session_id, block_no, prefix, range_start, range_end, next_value)
  values (v_edition, app.session_id(), v_block, v_prefix, v_start, v_start + v_size - 1, v_start)
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- ---------------------------------------------------------------------------
-- Default stations for new editions
-- ---------------------------------------------------------------------------
create or replace function public.create_edition(
  p_org uuid, p_name text, p_code_prefix text, p_starts_on date, p_ends_on date,
  p_venue text default null, p_clone_from uuid default null, p_is_training boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  s record;
  v_map jsonb := '{}';
  v_new_station uuid;
begin
  if not app.is_org_member(p_org, '{super_admin,coordinator}') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  insert into public.editions (org_id, name, code_prefix, starts_on, ends_on, venue, is_training)
  values (p_org, trim(p_name), upper(trim(p_code_prefix)), p_starts_on, p_ends_on, p_venue, coalesce(p_is_training, false))
  returning id into v_id;

  if p_clone_from is not null then
    if not app.is_edition_role(p_clone_from, '{super_admin,coordinator}') then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
    for s in select * from public.stations where edition_id = p_clone_from order by sort_order loop
      insert into public.stations (edition_id, kind, name, icon, color, sort_order, enabled, is_service, form_schema, join_pin_hash)
      values (v_id, s.kind, s.name, s.icon, s.color, s.sort_order, s.enabled, s.is_service, s.form_schema, app.hash_pin(app.random_pin()))
      returning id into v_new_station;
      v_map := v_map || jsonb_build_object(s.id::text, v_new_station);
    end loop;
    insert into public.inventory_items (edition_id, station_id, name, unit, sizes, opening_qty, low_threshold)
    select v_id, (v_map->>i.station_id::text)::uuid, i.name, i.unit, i.sizes, i.opening_qty, i.low_threshold
    from public.inventory_items i where i.edition_id = p_clone_from and v_map ? i.station_id::text;
  else
    insert into public.stations (edition_id, kind, name, icon, sort_order, is_service, join_pin_hash)
    select v_id, k::public.station_kind, n, ic, o, k <> 'registration', app.hash_pin(app.random_pin())
    from (values ('registration','Registration','ClipboardPen',0), ('prayer','Prayer & Counselling','HandHeart',1),
                 ('medical','Medical','Stethoscope',2), ('pharmacy','Pharmacy','Pill',3),
                 ('food','Food','UtensilsCrossed',4), ('clothing','Clothing','Shirt',5)) as d(k, n, ic, o);
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Existing editions: merge Prayer + Counselling, add Pharmacy
-- ---------------------------------------------------------------------------
do $$
declare e record; v_med public.stations; v_id uuid;
begin
  for e in select * from public.editions where status <> 'closed' loop
    update public.stations set name = 'Prayer & Counselling'
    where edition_id = e.id and kind = 'prayer' and name = 'Prayer';
    update public.stations set enabled = false
    where edition_id = e.id and kind = 'counselling'
      and exists (select 1 from public.stations p where p.edition_id = e.id and p.kind = 'prayer' and p.enabled);

    select * into v_med from public.stations where edition_id = e.id and kind = 'medical' order by sort_order limit 1;
    if found and not exists (select 1 from public.stations where edition_id = e.id and kind = 'pharmacy') then
      update public.stations set sort_order = sort_order + 1 where edition_id = e.id and sort_order > v_med.sort_order;
      insert into public.stations (edition_id, kind, name, icon, sort_order, is_service, join_pin_hash, role_pin_hash, lead_pin_hash)
      values (e.id, 'pharmacy', 'Pharmacy', 'Pill', v_med.sort_order + 1, true,
              app.hash_pin(case when e.is_training then '777777' else app.random_pin() end),
              case when e.is_training then app.hash_pin('707070') end,
              case when e.is_training then app.hash_pin('999999') end)
      returning id into v_id;
      if e.is_training then
        insert into public.station_secrets (station_id, join_pin_enc, role_pin_enc, lead_pin_enc)
        values (v_id, 'training:777777', 'training:707070', 'training:999999');
      end if;
    end if;
  end loop;
end $$;
