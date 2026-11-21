-- RPCs (see docs/Architecture.md §5). All SECURITY DEFINER functions check
-- permissions explicitly; SECURITY INVOKER ones rely on RLS.

-- ---------------------------------------------------------------------------
-- Small internals
-- ---------------------------------------------------------------------------
create or replace function app.request_ip() returns text
language plpgsql stable set search_path = '' as $$
declare v text;
begin
  begin
    v := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then v := null;
  end;
  return nullif(trim(v), '');
end $$;

create or replace function app.pin_matches(p_pin text, p_hash text) returns boolean
language sql immutable set search_path = '' as $$
  select p_pin is not null and p_hash is not null and p_hash = extensions.crypt(p_pin, p_hash)
$$;

create or replace function app.hash_pin(p_pin text) returns text
language sql volatile set search_path = '' as $$
  select extensions.crypt(p_pin, extensions.gen_salt('bf', 8))
$$;

create or replace function app.random_pin() returns text
language sql volatile set search_path = '' as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0')
$$;

-- Failures in the last 5 minutes for this user or IP.
create or replace function app.join_locked(p_uid uuid, p_ip text) returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) >= 5 from public.join_attempts a
  where a.success = false and a.at > now() - interval '5 minutes'
    and (a.user_id = p_uid or (p_ip is not null and a.ip = p_ip))
$$;

create or replace function app.require_role(p_edition uuid, p_roles public.org_role[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_edition_role(p_edition, p_roles) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
end $$;

create or replace function app.station_json(s public.stations) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'edition_id', s.edition_id, 'kind', s.kind, 'name', s.name, 'icon', s.icon,
    'color', s.color, 'sort_order', s.sort_order, 'enabled', s.enabled, 'is_service', s.is_service,
    'has_lead_pin', s.lead_pin_hash is not null)
$$;

-- ---------------------------------------------------------------------------
-- Volunteer join (FR-12.1, FR-12.2)
-- Returns {error: ...} instead of raising so failed attempts are recorded.
-- ---------------------------------------------------------------------------
create or replace function app.create_session(
  p_uid uuid, p_ip text, p_station public.stations, p_name text, p_phone text,
  p_role_pin text, p_designation text, p_device_label text, p_confidential_ack boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition public.editions;
  v_org public.organizations;
  v_confidential boolean := p_station.kind in ('medical','counselling');
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
      'needs_role_pin', v_station.kind in ('medical','counselling'));
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
      'needs_role_pin', v_station.kind in ('medical','counselling'));
  end if;

  return app.create_session(v_uid, v_ip, v_station, p_name, p_phone, p_role_pin, p_designation,
    p_device_label, p_confidential_ack);
end $$;

create or replace function public.leave_session() returns void
language sql security definer set search_path = '' as $$
  update public.volunteer_sessions set revoked_at = now()
  where user_id = auth.uid() and revoked_at is null;
$$;

-- Devices report every 30 s; the reply tells them if they were revoked/moved.
create or replace function public.heartbeat(p_pending int default 0, p_oldest timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_s public.volunteer_sessions;
  v_status public.edition_status;
begin
  update public.volunteer_sessions
  set last_seen_at = now(), pending_ops = greatest(coalesce(p_pending, 0), 0), oldest_pending_at = p_oldest
  where id = app.session_id()
  returning * into v_s;

  if not found then
    select * into v_s from public.volunteer_sessions where user_id = auth.uid() order by created_at desc limit 1;
    return jsonb_build_object('active', false,
      'revoked', coalesce(v_s.revoked_at is not null, false),
      'expired', coalesce(v_s.expires_at <= now(), false));
  end if;

  select status into v_status from public.editions where id = v_s.edition_id;
  return jsonb_build_object('active', true, 'revoked', false, 'expired', false,
    'edition_status', v_status, 'station_id', v_s.station_id, 'role', v_s.role, 'server_time', now());
end $$;

create or replace function public.request_lead_override(p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ip text := app.request_ip();
  v_station public.stations;
  v_id uuid;
begin
  if app.session_id() is null then raise exception 'no_session' using errcode = '42501'; end if;
  if app.join_locked(v_uid, v_ip) then
    return jsonb_build_object('error', 'locked', 'retry_after_seconds', 300);
  end if;
  select * into v_station from public.stations where id = app.session_station();
  if not app.pin_matches(p_pin, v_station.lead_pin_hash) then
    insert into public.join_attempts (user_id, ip, success) values (v_uid, v_ip, false);
    return jsonb_build_object('error', 'invalid_lead_pin');
  end if;
  insert into public.lead_overrides (station_id, session_id) values (v_station.id, app.session_id())
  returning id into v_id;
  return jsonb_build_object('override_id', v_id);
end $$;

-- ---------------------------------------------------------------------------
-- Lookup (FR-4.2) and duplicates (FR-3.6, FR-3.7)
-- ---------------------------------------------------------------------------
create or replace function public.search_beneficiaries(p_edition uuid, p_q text, p_limit int default 20)
returns table (
  visit_id uuid, beneficiary_id uuid, full_name text, card_code text, age_range public.age_range,
  gender public.gender, community text, phone_last4 text, score real
) language sql stable security invoker set search_path = '' as $$
  with q as (select lower(trim(coalesce(p_q, ''))) as q, regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as digits)
  select v.id, b.id, b.full_name, v.card_code, b.age_range, b.gender, b.community, b.phone_last4,
    greatest(
      case when v.card_code is not null and lower(v.card_code) like '%' || q.q then 1.0 else 0 end,
      case when length(q.digits) >= 4 and b.phone_last4 = right(q.digits, 4) then 0.9 else 0 end,
      extensions.similarity(b.full_name_search, q.q)
    )::real as score
  from public.visits v
  join public.beneficiaries b on b.id = v.beneficiary_id
  cross join q
  where v.edition_id = p_edition and v.deleted_at is null and b.deleted_at is null and length(q.q) >= 2
    and (
      (v.card_code is not null and lower(v.card_code) like '%' || q.q)
      or (length(q.digits) >= 4 and (b.phone_last4 = right(q.digits, 4) or b.phone like '%' || q.digits))
      or b.full_name_search operator(extensions.%) q.q
      or b.full_name_search like '%' || q.q || '%'
    )
  order by score desc, b.full_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.find_duplicates(p_edition uuid, p_name text, p_phone text default null)
returns table (
  beneficiary_id uuid, full_name text, age_range public.age_range, gender public.gender, community text,
  language text, phone_last4 text, last_edition_name text, last_visit_year int,
  visit_id_this_edition uuid, card_code_this_edition text, match_reason text
) language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.editions where id = p_edition;
  if not (app.is_edition_role(p_edition, '{super_admin,coordinator}')
          or (app.session_edition() = p_edition and app.session_kind() = 'registration')) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return query
  with cand as (
    select b.*,
      case when p_phone is not null and b.phone = p_phone then 'phone' else 'name' end as reason,
      case when p_phone is not null and b.phone = p_phone then 1.0
           else extensions.similarity(b.full_name_search, lower(trim(coalesce(p_name, '')))) end as score
    from public.beneficiaries b
    where b.org_id = v_org and b.deleted_at is null and b.merged_into is null
      and ((p_phone is not null and b.phone = p_phone)
           or (length(trim(coalesce(p_name, ''))) >= 3
               and extensions.similarity(b.full_name_search, lower(trim(p_name))) > 0.45))
  )
  select c.id, c.full_name, c.age_range, c.gender, c.community, c.language, c.phone_last4,
    last_v.name, extract(year from last_v.starts_on)::int,
    this_v.id, this_v.card_code, c.reason
  from cand c
  left join lateral (
    select e.name, e.starts_on from public.visits v join public.editions e on e.id = v.edition_id
    where v.beneficiary_id = c.id and v.edition_id <> p_edition and not e.is_training
    order by e.starts_on desc limit 1
  ) last_v on true
  left join lateral (
    select v.id, v.card_code from public.visits v where v.beneficiary_id = c.id and v.edition_id = p_edition
  ) this_v on true
  order by c.score desc
  limit 5;
end $$;

-- ---------------------------------------------------------------------------
-- Offline snapshot + delta (FR-13.3). SECURITY INVOKER: RLS filters flags,
-- confidential records etc. exactly as for direct reads.
-- ---------------------------------------------------------------------------
create or replace function app.is_returning(p_beneficiary uuid, p_edition uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.visits v join public.editions e on e.id = v.edition_id
                 where v.beneficiary_id = p_beneficiary and v.edition_id <> p_edition and not e.is_training
                   and e.starts_on < (select starts_on from public.editions where id = p_edition))
$$;

create or replace function app.visit_rows(p_edition uuid, p_visit_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'edition_id', v.edition_id, 'beneficiary_id', v.beneficiary_id, 'card_code', v.card_code,
    'household_size', v.household_size, 'status', v.status, 'registered_at', v.registered_at,
    'registered_by_name', v.registered_by_name, 'checked_out_at', v.checked_out_at,
    'consent_followup', v.consent_followup_at is not null, 'updated_at', v.updated_at,
    'full_name', b.full_name, 'phone_last4', b.phone_last4, 'gender', b.gender, 'age_range', b.age_range,
    'community', b.community, 'language', b.language, 'church_member', b.church_member,
    'guardian_name', b.guardian_name, 'returning', app.is_returning(b.id, v.edition_id),
    'deleted', v.deleted_at is not null
  ) order by v.id), '[]'::jsonb)
  from public.visits v join public.beneficiaries b on b.id = v.beneficiary_id
  where v.edition_id = p_edition and v.id = any (p_visit_ids)
$$;

create or replace function app.related_rows(p_edition uuid, p_visit_ids uuid[], p_since timestamptz)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'needs', (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from public.visit_needs n
              where n.edition_id = p_edition
                and (case when p_since is null then n.visit_id = any (p_visit_ids) else n.updated_at > p_since end)),
    'records', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'visit_id', r.visit_id, 'station_id', r.station_id, 'served_by_name', r.served_by_name,
                  'summary', r.summary, 'data', r.data, 'has_confidential', r.has_confidential, 'served_at', r.served_at,
                  'voided_at', r.voided_at, 'updated_at', r.updated_at)), '[]'::jsonb)
                from public.service_records r
                where r.edition_id = p_edition
                  and (case when p_since is null then r.visit_id = any (p_visit_ids) else r.updated_at > p_since end)),
    'confidential', (select coalesce(jsonb_agg(jsonb_build_object(
                  'service_record_id', c.service_record_id, 'visit_id', c.visit_id, 'kind', c.kind,
                  'payload', c.payload, 'created_at', c.created_at)), '[]'::jsonb)
                from public.confidential_records c
                where c.edition_id = p_edition
                  and (case when p_since is null then c.visit_id = any (p_visit_ids) else c.created_at > p_since end)),
    'flags', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.flags f
              where f.edition_id = p_edition
                and (case when p_since is null then f.visit_id = any (p_visit_ids) else f.updated_at > p_since end))
  )
$$;

create or replace function public.edition_snapshot(p_edition uuid, p_page int default 0, p_page_size int default 1000)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_ids uuid[];
  v_total int;
  v_size int := least(greatest(coalesce(p_page_size, 1000), 50), 2000);
  v_result jsonb;
begin
  if not app.can_access_edition(p_edition) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select count(*) into v_total from public.visits where edition_id = p_edition;
  select array_agg(id) into v_ids from (
    select id from public.visits where edition_id = p_edition order by id offset p_page * v_size limit v_size
  ) x;
  v_ids := coalesce(v_ids, '{}');

  v_result := jsonb_build_object(
    'page', p_page, 'total', v_total, 'has_more', (p_page + 1) * v_size < v_total,
    'server_time', now(),
    'visits', app.visit_rows(p_edition, v_ids)
  ) || app.related_rows(p_edition, v_ids, null);

  if p_page = 0 then
    v_result := v_result || jsonb_build_object(
      'stations', (select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order), '[]'::jsonb)
                   from public.stations_public s where s.edition_id = p_edition),
      'inventory', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'station_id', i.station_id, 'name', i.name,
                     'unit', i.unit, 'sizes', i.sizes, 'opening_qty', i.opening_qty, 'remaining', i.remaining,
                     'low_threshold', i.low_threshold, 'updated_at', i.updated_at) order by i.name), '[]'::jsonb)
                    from public.inventory_items i where i.edition_id = p_edition)
    );
  end if;
  return v_result;
end $$;

create or replace function public.edition_delta(p_edition uuid, p_since timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_ids uuid[];
begin
  if not app.can_access_edition(p_edition) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select array_agg(v.id) into v_ids
  from public.visits v join public.beneficiaries b on b.id = v.beneficiary_id
  where v.edition_id = p_edition and (v.updated_at > p_since or b.updated_at > p_since);

  return jsonb_build_object(
    'server_time', now(),
    'visits', app.visit_rows(p_edition, coalesce(v_ids, '{}')),
    'stations', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.stations_public s
                 where s.edition_id = p_edition and s.updated_at > p_since),
    'inventory', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'station_id', i.station_id, 'name', i.name,
                   'unit', i.unit, 'sizes', i.sizes, 'opening_qty', i.opening_qty, 'remaining', i.remaining,
                   'low_threshold', i.low_threshold, 'updated_at', i.updated_at)), '[]'::jsonb)
                  from public.inventory_items i where i.edition_id = p_edition and i.updated_at > p_since)
  ) || app.related_rows(p_edition, null, p_since);
end $$;

-- ---------------------------------------------------------------------------
-- Field-level last-write-wins patches (FR-5.6, FR-13.5)
-- ---------------------------------------------------------------------------
create or replace function public.apply_patch(p_table text, p_id uuid, p_fields jsonb, p_client_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_allowed text[];
  v_field_ts jsonb;
  v_key text;
  v_applied text[] := '{}';
  v_rejected jsonb := '{}';
  v_ok boolean;
  v_org uuid;
  v_edition uuid;
begin
  if p_client_updated_at is null or p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception 'invalid_patch' using errcode = '22023';
  end if;

  if p_table = 'beneficiaries' then
    v_allowed := array['full_name','phone','gender','age_range','community','language','church_member','guardian_name','guardian_beneficiary_id'];
    select org_id, field_updated_at into v_org, v_field_ts from public.beneficiaries where id = p_id;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    v_ok := app.is_org_member(v_org, '{super_admin,coordinator}')
         or exists (select 1 from public.visits v where v.beneficiary_id = p_id and v.edition_id = app.session_edition());
  elsif p_table = 'visits' then
    v_allowed := array['household_size','status','checked_out_at','consent_followup_at'];
    select edition_id, field_updated_at into v_edition, v_field_ts from public.visits where id = p_id;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    v_ok := app.is_edition_role(v_edition, '{super_admin,coordinator}') or app.session_edition() = v_edition;
  else
    raise exception 'invalid_table' using errcode = '22023';
  end if;

  if not v_ok then raise exception 'permission_denied' using errcode = '42501'; end if;

  for v_key in select jsonb_object_keys(p_fields) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'field_not_allowed: %', v_key using errcode = '22023';
    end if;
    if v_field_ts ? v_key and (v_field_ts->>v_key)::timestamptz >= p_client_updated_at then
      v_rejected := v_rejected || jsonb_build_object(v_key, p_fields->v_key);
      continue;
    end if;
    execute format(
      'update public.%I t set %I = (jsonb_populate_record(null::public.%I, $1)).%I,
         field_updated_at = t.field_updated_at || jsonb_build_object(%L, $2::text)
       where id = $3', p_table, v_key, p_table, v_key, v_key)
    using p_fields, p_client_updated_at, p_id;
    v_applied := v_applied || v_key;
  end loop;

  if v_rejected <> '{}'::jsonb then
    insert into public.audit_log (actor_user, actor_session, action, table_name, row_id, after, meta)
    values (auth.uid(), app.session_id(), 'patch_rejected', p_table, p_id, v_rejected,
            jsonb_build_object('client_updated_at', p_client_updated_at, 'reason', 'older_than_server'));
  end if;
  return jsonb_build_object('applied', to_jsonb(v_applied), 'rejected', v_rejected);
end $$;

-- Needs: add (registration), decline (FR-6.7), refer (FR-6.7) — idempotent.
create or replace function public.set_need(
  p_visit uuid, p_station uuid, p_state public.need_state, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_edition uuid;
  v_current public.need_state;
begin
  select edition_id into v_edition from public.visits where id = p_visit;
  if v_edition is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (app.session_edition() = v_edition or app.is_edition_role(v_edition, '{super_admin,coordinator}')) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.stations where id = p_station and edition_id = v_edition) then
    raise exception 'invalid_station' using errcode = '22023';
  end if;

  if p_state = 'referred' then
    perform app.refer_to_station(v_edition, p_visit, p_station, coalesce(app.session_station(), p_station), app.session_id());
    return;
  end if;
  if p_state = 'served' then
    raise exception 'served_is_set_by_service_records' using errcode = '22023';
  end if;

  select state into v_current from public.visit_needs where visit_id = p_visit and station_id = p_station;
  if v_current = 'served' then return; end if;  -- never downgrade a served need

  insert into public.visit_needs (visit_id, station_id, edition_id, state, source, state_at, declined_reason)
  values (p_visit, p_station, v_edition, p_state, 'registration', now(),
          case when p_state = 'declined' then left(p_reason, 200) end)
  on conflict (visit_id, station_id) do update
    set state = excluded.state, state_at = now(), declined_reason = excluded.declined_reason;
end $$;

create or replace function public.void_service_record(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.service_records;
begin
  select * into r from public.service_records where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.voided_at is not null then return; end if;
  if not (
    (r.session_id = app.session_id() and r.created_at > now() - interval '10 minutes')
    or (app.session_is_lead() and app.session_station() = r.station_id)
    or app.is_edition_role(r.edition_id, '{super_admin,coordinator}')
  ) then
    raise exception 'permission_denied' using errcode = '42501', hint = 'After 10 minutes, ask your Station Lead.';
  end if;
  update public.service_records
  set voided_at = now(), voided_by = auth.uid(), void_reason = left(coalesce(p_reason, 'undo'), 200)
  where id = p_id;
end $$;

create or replace function public.resolve_flag(p_flag uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_edition uuid;
begin
  select edition_id into v_edition from public.flags where id = p_flag;
  if not (app.is_edition_role(v_edition, '{super_admin,coordinator}')
          or (app.session_edition() = v_edition and app.session_is_lead())) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.flags set resolved_at = now() where id = p_flag and resolved_at is null;
end $$;

-- ---------------------------------------------------------------------------
-- Cards (FR-2.x)
-- ---------------------------------------------------------------------------
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
  select coalesce(max(substring(code from '-(\d+)$')::int), 0) + 1 into v_start
    from public.cards where edition_id = p_edition and code ~ ('^' || v_prefix || '-\d+$');
  v_width := greatest(4, length((v_start + p_count - 1)::text));

  insert into public.cards (edition_id, code, batch_no)
  select p_edition, v_prefix || '-' || lpad(n::text, v_width, '0'), v_batch
  from generate_series(v_start, v_start + p_count - 1) n;

  return jsonb_build_object('batch_no', v_batch, 'count', p_count,
    'first', v_prefix || '-' || lpad(v_start::text, v_width, '0'),
    'last', v_prefix || '-' || lpad((v_start + p_count - 1)::text, v_width, '0'));
end $$;

create or replace function public.replace_card(p_visit uuid, p_new_code text, p_reason text default 'lost')
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (app.session_edition() = v.edition_id or app.is_edition_role(v.edition_id, '{super_admin,coordinator}')) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if v.card_code = upper(trim(p_new_code)) then return; end if;
  if v.card_code is not null then
    update public.cards set status = 'void', voided_reason = left(coalesce(p_reason, 'lost'), 200)
    where edition_id = v.edition_id and code = v.card_code;
  end if;
  update public.visits set card_code = upper(trim(p_new_code)) where id = p_visit;
end $$;

create or replace function public.reserve_code_block(p_size int default 200)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition uuid := app.session_edition();
  v_prefix text;
  v_block int;
  v_row public.code_blocks;
begin
  if v_edition is null or app.session_kind() <> 'registration' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v_row from public.code_blocks where session_id = app.session_id() and next_value <= range_end limit 1;
  if found then return to_jsonb(v_row); end if;

  perform pg_advisory_xact_lock(hashtext(v_edition::text));
  select code_prefix into v_prefix from public.editions where id = v_edition;
  select coalesce(max(block_no), 0) + 1 into v_block from public.code_blocks where edition_id = v_edition;
  insert into public.code_blocks (edition_id, session_id, block_no, prefix, range_start, range_end, next_value)
  values (v_edition, app.session_id(), v_block, v_prefix || '-R' || v_block, 1,
          least(greatest(coalesce(p_size, 200), 10), 999), 1)
  returning * into v_row;
  return to_jsonb(v_row);
end $$;

-- ---------------------------------------------------------------------------
-- Inventory adjustments (FR-8.2)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_inventory(p_id uuid, p_item uuid, p_delta int, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.inventory_items;
begin
  select * into i from public.inventory_items where id = p_item;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (app.is_edition_role(i.edition_id, '{super_admin,coordinator}')
          or (app.session_is_lead() and app.session_station() = i.station_id)) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_reason not in ('restock','damage','correction') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  insert into public.inventory_movements (id, item_id, delta, reason, session_or_user)
  values (p_id, p_item, p_delta, p_reason, coalesce(app.session_id(), auth.uid()))
  on conflict (id) do nothing;
  if found then
    update public.inventory_items set remaining = remaining + p_delta where id = p_item;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Editions and stations (FR-1.x)
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
    from (values ('registration','Registration','ClipboardPen',0), ('prayer','Prayer','HandHeart',1),
                 ('counselling','Counselling','MessagesSquare',2), ('medical','Medical','Stethoscope',3),
                 ('food','Food','UtensilsCrossed',4), ('clothing','Clothing','Shirt',5)) as d(k, n, ic, o);
  end if;
  return v_id;
end $$;

create or replace function public.add_station(p_edition uuid, p_kind public.station_kind, p_name text, p_icon text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform app.require_role(p_edition, '{super_admin,coordinator}');
  insert into public.stations (edition_id, kind, name, icon, sort_order, is_service, join_pin_hash)
  values (p_edition, p_kind, trim(p_name), p_icon,
          (select coalesce(max(sort_order), 0) + 1 from public.stations where edition_id = p_edition),
          p_kind not in ('registration','checkout'), app.hash_pin(app.random_pin()))
  returning id into v_id;
  return v_id;
end $$;

-- Null = leave unchanged; '' = clear (role/lead only).
create or replace function public.set_station_pins(
  p_station uuid, p_join_pin text default null, p_role_pin text default null, p_lead_pin text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  st public.stations;
  v_org uuid;
begin
  select * into st from public.stations where id = p_station;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_role(st.edition_id, '{super_admin,coordinator}');
  select org_id into v_org from public.editions where id = st.edition_id;

  if p_join_pin is not null then
    if p_join_pin !~ '^[0-9]{6}$' then raise exception 'pin_must_be_6_digits' using errcode = '22023'; end if;
    if exists (select 1 from public.stations s2 join public.editions e on e.id = s2.edition_id
               where e.org_id = v_org and e.status <> 'closed' and s2.id <> p_station
                 and app.pin_matches(p_join_pin, s2.join_pin_hash)) then
      raise exception 'pin_in_use' using errcode = '23505', hint = 'Another station already uses this PIN.';
    end if;
    update public.stations set join_pin_hash = app.hash_pin(p_join_pin) where id = p_station;
  end if;
  if p_role_pin is not null then
    if p_role_pin <> '' and p_role_pin !~ '^[0-9]{6}$' then raise exception 'pin_must_be_6_digits' using errcode = '22023'; end if;
    update public.stations set role_pin_hash = case when p_role_pin = '' then null else app.hash_pin(p_role_pin) end where id = p_station;
  end if;
  if p_lead_pin is not null then
    if p_lead_pin <> '' and p_lead_pin !~ '^[0-9]{6}$' then raise exception 'pin_must_be_6_digits' using errcode = '22023'; end if;
    update public.stations set lead_pin_hash = case when p_lead_pin = '' then null else app.hash_pin(p_lead_pin) end where id = p_station;
  end if;
  insert into public.audit_log (actor_user, action, table_name, row_id, meta)
  values (auth.uid(), 'pin_rotate', 'stations', p_station,
          jsonb_build_object('join', p_join_pin is not null, 'role', p_role_pin is not null, 'lead', p_lead_pin is not null));
end $$;

create or replace function public.close_edition(p_edition uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_unsynced int;
begin
  perform app.require_role(p_edition, '{super_admin,coordinator}');
  select count(*) into v_unsynced from public.volunteer_sessions
  where edition_id = p_edition and revoked_at is null and pending_ops > 0;
  if v_unsynced > 0 and not coalesce(p_force, false) then
    return jsonb_build_object('closed', false, 'unsynced_devices', v_unsynced);
  end if;
  update public.editions set status = 'closed' where id = p_edition and status <> 'closed';
  insert into public.audit_log (actor_user, action, table_name, row_id, meta)
  values (auth.uid(), 'close_edition', 'editions', p_edition, jsonb_build_object('unsynced_devices', v_unsynced, 'forced', p_force));
  return jsonb_build_object('closed', true, 'unsynced_devices', v_unsynced);
end $$;

-- ---------------------------------------------------------------------------
-- Volunteer management (FR-12.3)
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
  update public.volunteer_sessions set station_id = p_station, role = 'volunteer' where id = p_session;
  insert into public.audit_log (actor_user, action, table_name, row_id, meta)
  values (auth.uid(), 'move_session', 'volunteer_sessions', p_session, jsonb_build_object('to_station', p_station));
end $$;

create or replace function public.revoke_session(p_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.volunteer_sessions;
begin
  select * into s from public.volunteer_sessions where id = p_session;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_role(s.edition_id, '{super_admin,coordinator}');
  update public.volunteer_sessions set revoked_at = now() where id = p_session and revoked_at is null;
  insert into public.audit_log (actor_user, action, table_name, row_id) values (auth.uid(), 'revoke_session', 'volunteer_sessions', p_session);
end $$;

-- ---------------------------------------------------------------------------
-- Confidential break-glass (Architecture §3)
-- ---------------------------------------------------------------------------
create or replace function public.break_glass(p_kind public.confidential_kind, p_visit uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition uuid;
  v_expires timestamptz := now() + interval '1 hour';
begin
  select edition_id into v_edition from public.visits where id = p_visit;
  perform app.require_role(v_edition, '{super_admin,coordinator}');
  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = '22023', hint = 'Give a reason of at least 10 characters.';
  end if;
  insert into public.break_glass_grants (user_id, kind, visit_id, reason, expires_at)
  values (auth.uid(), p_kind, p_visit, trim(p_reason), v_expires);
  insert into public.audit_log (actor_user, action, table_name, row_id, meta)
  values (auth.uid(), 'break_glass', 'visits', p_visit, jsonb_build_object('kind', p_kind, 'reason', trim(p_reason), 'expires_at', v_expires));
  return jsonb_build_object('expires_at', v_expires);
end $$;

-- Admin read of confidential detail; every read through break-glass is audited.
create or replace function public.get_confidential(p_visit uuid)
returns setof public.confidential_records language plpgsql security definer set search_path = '' as $$
declare r public.confidential_records;
begin
  for r in select * from public.confidential_records where visit_id = p_visit order by created_at loop
    if app.has_confidential(r.kind, p_visit) then
      if app.session_id() is null then
        insert into public.audit_log (actor_user, action, table_name, row_id, meta)
        values (auth.uid(), 'confidential_view', 'confidential_records', r.service_record_id, jsonb_build_object('kind', r.kind));
      end if;
      return next r;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Duplicate merge (FR-9.7)
-- ---------------------------------------------------------------------------
create or replace function public.merge_beneficiaries(p_keep uuid, p_merge uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  k public.beneficiaries;
  m public.beneficiaries;
begin
  select * into k from public.beneficiaries where id = p_keep;
  select * into m from public.beneficiaries where id = p_merge;
  if k.id is null or m.id is null or k.id = m.id then raise exception 'invalid_merge' using errcode = '22023'; end if;
  if not app.is_org_member(k.org_id, '{super_admin,coordinator}') or k.org_id <> m.org_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.visits a join public.visits b on a.edition_id = b.edition_id
             where a.beneficiary_id = p_keep and b.beneficiary_id = p_merge) then
    raise exception 'both_visited_same_edition' using errcode = '23505',
      hint = 'Both records attended the same edition. Void one visit first.';
  end if;

  perform set_config('app.allow_closed_write', 'on', true);
  update public.visits set beneficiary_id = p_keep where beneficiary_id = p_merge;
  update public.beneficiaries set
    phone = coalesce(k.phone, m.phone), gender = coalesce(k.gender, m.gender),
    age_range = coalesce(k.age_range, m.age_range), community = coalesce(k.community, m.community),
    language = coalesce(k.language, m.language), church_member = coalesce(k.church_member, m.church_member),
    guardian_name = coalesce(k.guardian_name, m.guardian_name)
  where id = p_keep;
  update public.beneficiaries set merged_into = p_keep, deleted_at = now(), phone = null where id = p_merge;
  perform set_config('app.allow_closed_write', '', true);

  insert into public.audit_log (actor_user, action, table_name, row_id, before, meta)
  values (auth.uid(), 'merge', 'beneficiaries', p_keep, to_jsonb(m) - 'full_name_search', jsonb_build_object('merged', p_merge));
end $$;

-- ---------------------------------------------------------------------------
-- Follow-up pipeline (FR-10.x). Contacts only for people who consented.
-- ---------------------------------------------------------------------------
create or replace function public.list_followups(p_edition uuid)
returns table (
  id uuid, type public.followup_type, status public.followup_status, assignee_user_id uuid, assignee_name text,
  due_on date, created_at timestamptz, visit_id uuid, card_code text, full_name text, community text,
  age_range public.age_range, gender public.gender, phone text, consented boolean, preferred_time text,
  last_outcome text, last_outcome_at timestamptz, last_note text
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_role(p_edition, '{super_admin,coordinator,followup}');
  return query
  select f.id, f.type, f.status, f.assignee_user_id, m.display_name, f.due_on, f.created_at, v.id, v.card_code,
    b.full_name, b.community, b.age_range, b.gender,
    case when v.consent_followup_at is not null then b.phone end,
    v.consent_followup_at is not null, f.preferred_time,
    ev.outcome, ev.created_at, ev.note
  from public.followups f
  join public.visits v on v.id = f.visit_id
  join public.beneficiaries b on b.id = v.beneficiary_id
  join public.editions e on e.id = f.edition_id
  left join public.org_members m on m.user_id = f.assignee_user_id and m.org_id = e.org_id
  left join lateral (select fe.outcome, fe.created_at, fe.note from public.followup_events fe
                     where fe.followup_id = f.id order by fe.created_at desc limit 1) ev on true
  where f.edition_id = p_edition
  order by f.created_at;
end $$;

create or replace function public.list_assignees(p_edition uuid)
returns table (user_id uuid, display_name text, role public.org_role)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_role(p_edition, '{super_admin,coordinator,followup}');
  return query select m.user_id, coalesce(m.display_name, 'Team member'), m.role
  from public.org_members m join public.editions e on e.org_id = m.org_id
  where e.id = p_edition and m.role in ('super_admin','coordinator','followup')
  order by m.display_name;
end $$;

create or replace function public.assign_followup(p_followup uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.followups;
begin
  select * into f from public.followups where id = p_followup;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (app.is_edition_role(f.edition_id, '{super_admin,coordinator}')
          or (app.is_edition_role(f.edition_id, '{followup}') and p_user = auth.uid())) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.followups set assignee_user_id = p_user,
    status = case when p_user is null then 'new'::public.followup_status
                  when status = 'new' then 'assigned'::public.followup_status else status end
  where id = p_followup;
end $$;

create or replace function public.log_followup(
  p_followup uuid, p_outcome text, p_note text default null, p_status public.followup_status default null
) returns void language plpgsql security definer set search_path = '' as $$
declare f public.followups;
begin
  select * into f from public.followups where id = p_followup;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_role(f.edition_id, '{super_admin,coordinator,followup}');
  insert into public.followup_events (followup_id, outcome, note, by_user)
  values (p_followup, p_outcome, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  update public.followups set status = coalesce(p_status, case p_outcome
      when 'reached' then 'contacted'::public.followup_status
      when 'visited' then 'contacted'::public.followup_status
      when 'wrong_number' then 'unreachable'::public.followup_status
      else case when status = 'new' then 'assigned'::public.followup_status else status end end),
    assignee_user_id = coalesce(assignee_user_id, auth.uid())
  where id = p_followup;
end $$;

-- ---------------------------------------------------------------------------
-- Exports audit (FR-11.2)
-- ---------------------------------------------------------------------------
create or replace function public.log_export(p_edition uuid, p_dataset text, p_rows int, p_format text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_role(p_edition, '{super_admin,coordinator}');
  insert into public.audit_log (actor_user, action, table_name, meta)
  values (auth.uid(), 'export', p_dataset, jsonb_build_object('edition_id', p_edition, 'rows', p_rows, 'format', p_format));
end $$;

-- ---------------------------------------------------------------------------
-- Live dashboard (FR-9.x) — non-confidential aggregates only
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(p_edition uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform app.require_role(p_edition, '{super_admin,coordinator,followup,viewer}');

  with
  vis as (select * from public.visits where edition_id = p_edition and deleted_at is null),
  rec as (select r.*, s.kind from public.service_records r join public.stations s on s.id = r.station_id
          where r.edition_id = p_edition and r.voided_at is null),
  gaps as (
    select station_id, extract(epoch from served_at - lag(served_at) over (partition by session_id order by served_at)) as gap
    from rec
  ),
  st as (
    select s.id, s.kind, s.name, s.icon, s.sort_order, s.enabled,
      (select count(distinct r.visit_id) from rec r where r.station_id = s.id) as served,
      (select count(*) from public.visit_needs n join vis on vis.id = n.visit_id
        where n.station_id = s.id and n.state in ('pending','referred')) as pending,
      (select round(avg(g.gap)) from gaps g where g.station_id = s.id and g.gap between 5 and 1200) as avg_service_seconds,
      (select count(*) from public.volunteer_sessions vs where vs.station_id = s.id and vs.revoked_at is null
         and vs.expires_at > now() and vs.last_seen_at > now() - interval '10 minutes') as active_volunteers,
      (select coalesce(sum(i.remaining), 0) from public.inventory_items i where i.station_id = s.id) as stock_remaining,
      (select coalesce(sum(i.opening_qty), 0) from public.inventory_items i where i.station_id = s.id) as stock_opening,
      (select count(*) from public.inventory_items i where i.station_id = s.id) as stock_items
    from public.stations s where s.edition_id = p_edition
  )
  select jsonb_build_object(
    'generated_at', now(),
    'kpis', jsonb_build_object(
      'registered', (select count(*) from vis),
      'served_unique', (select count(distinct visit_id) from rec),
      'services', (select count(*) from rec where kind not in ('registration','checkout')),
      'on_site', (select count(*) from vis where status = 'active'),
      'checked_out', (select count(*) from vis where status = 'checked_out'),
      'salvations', (select count(*) from rec where kind = 'prayer' and data->>'decision' = 'salvation'),
      'rededications', (select count(*) from rec where kind = 'prayer' and data->>'decision' = 'rededication'),
      'decisions', (select count(*) from rec where kind = 'prayer' and data->>'decision' in ('salvation','rededication')),
      'referrals', (select count(*) from rec where kind = 'medical' and coalesce((data->>'referred')::boolean, false)),
      'urgent_counselling', (select count(*) from rec where kind = 'counselling' and data->>'risk' = 'urgent'),
      'followups', (select count(*) from public.followups where edition_id = p_edition),
      'volunteers', (select count(distinct display_name || coalesce(phone, '')) from public.volunteer_sessions where edition_id = p_edition),
      'missing_followup_consent', (select count(*) from vis where consent_followup_at is null)
    ),
    'stations', (select coalesce(jsonb_agg(to_jsonb(st) order by st.sort_order), '[]'::jsonb) from st),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'remaining', i.remaining,
                    'low_threshold', i.low_threshold, 'station', s.name) order by i.remaining), '[]'::jsonb)
                  from public.inventory_items i join public.stations s on s.id = i.station_id
                  where i.edition_id = p_edition and i.remaining <= i.low_threshold),
    'urgent_flags', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'text', f.text,
                      'created_at', f.created_at, 'visit_id', f.visit_id, 'card_code', v2.card_code) order by f.created_at desc), '[]'::jsonb)
                     from public.flags f join public.visits v2 on v2.id = f.visit_id
                     where f.edition_id = p_edition and f.scope = 'leads' and f.resolved_at is null),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('session_id', vs.id, 'name', vs.display_name,
                  'device_label', vs.device_label, 'station', s.name, 'station_kind', s.kind, 'role', vs.role,
                  'last_seen_at', vs.last_seen_at, 'pending_ops', vs.pending_ops,
                  'oldest_pending_at', vs.oldest_pending_at, 'created_at', vs.created_at,
                  'records', (select count(*) from rec where rec.session_id = vs.id)) order by vs.last_seen_at desc nulls last), '[]'::jsonb)
                from public.volunteer_sessions vs join public.stations s on s.id = vs.station_id
                where vs.edition_id = p_edition and vs.revoked_at is null and vs.expires_at > now()),
    'hourly', (select coalesce(jsonb_agg(h order by h.hour), '[]'::jsonb) from (
                 select hr as hour,
                   (select count(*) from vis where date_trunc('hour', registered_at at time zone 'Africa/Lagos') = hr) as arrivals,
                   (select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) from (
                      select kind::text as k, count(*) as c from rec
                      where date_trunc('hour', served_at at time zone 'Africa/Lagos') = hr and kind <> 'registration'
                      group by kind) z) as services
                 from (select distinct date_trunc('hour', registered_at at time zone 'Africa/Lagos') as hr from vis
                       union select distinct date_trunc('hour', served_at at time zone 'Africa/Lagos') from rec) hrs
               ) h),
    'demographics', jsonb_build_object(
      'gender', (select coalesce(jsonb_object_agg(coalesce(g::text, 'unknown'), c), '{}'::jsonb) from (
                   select b.gender g, count(*) c from vis join public.beneficiaries b on b.id = vis.beneficiary_id group by 1) x),
      'age_range', (select coalesce(jsonb_object_agg(coalesce(a::text, 'unknown'), c), '{}'::jsonb) from (
                   select b.age_range a, count(*) c from vis join public.beneficiaries b on b.id = vis.beneficiary_id group by 1) x),
      'communities', (select coalesce(jsonb_agg(jsonb_build_object('community', cm, 'count', c) order by c desc), '[]'::jsonb) from (
                   select coalesce(nullif(trim(b.community), ''), 'Not given') cm, count(*) c
                   from vis join public.beneficiaries b on b.id = vis.beneficiary_id group by 1 order by 2 desc limit 10) x)
    ),
    'followups_by_status', (select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) from (
                   select status::text, count(*) c from public.followups where edition_id = p_edition group by 1) x),
    'followups_by_type', (select coalesce(jsonb_object_agg(type, c), '{}'::jsonb) from (
                   select type::text, count(*) c from public.followups where edition_id = p_edition group by 1) x),
    'stock', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'station', s.name, 'unit', i.unit,
                   'opening', i.opening_qty, 'remaining', i.remaining, 'used', i.opening_qty - i.remaining) order by s.sort_order, i.name), '[]'::jsonb)
              from public.inventory_items i join public.stations s on s.id = i.station_id where i.edition_id = p_edition),
    'data_quality', jsonb_build_object(
      'cards_voided', (select count(*) from public.cards where edition_id = p_edition and status = 'void'),
      'card_conflicts', (select count(*) from public.flags where edition_id = p_edition and kind = 'card_conflict' and resolved_at is null),
      'visits_without_card', (select count(*) from vis where card_code is null)
    )
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Retention (FR-14.3) — service role only (cron)
-- ---------------------------------------------------------------------------
create or replace function public.redact_expired_confidential() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform set_config('app.allow_closed_write', 'on', true);
  update public.confidential_records c
  set payload = '{"redacted": true}'::jsonb, redacted_at = now()
  from public.editions e join public.organizations o on o.id = e.org_id
  where c.edition_id = e.id and c.redacted_at is null and e.status = 'closed'
    and e.closed_at + make_interval(months => o.retention_months) < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Grants: nothing for anon; authenticated may call the public RPCs.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.redact_expired_confidential() from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
