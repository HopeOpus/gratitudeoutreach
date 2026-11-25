-- Pastor Ade's patient flow:
--   Registration > Medical Assistant > General Doctor (> Optician / Laboratory) > Counselling > Pharmacy > Clothing and Food.
-- 1. Medical is split into Medical Assistant, General Doctor, Optician and Laboratory. They share one
--    medical record (confidential_records.kind = 'medical').
-- 2. Counselling is compulsory: Pharmacy cannot save anything before it (Station Lead override only).
-- 3. Spiritual outcomes live in confidential_records.kind = 'spiritual' (Counselling and coordinators).
-- 4. Laboratory and Optician needs, records and alerts are visible to the medical team only.

-- ---------------------------------------------------------------------------
-- Kind helpers
-- ---------------------------------------------------------------------------
create or replace function app.is_confidential_kind(p_kind public.station_kind) returns boolean
language sql immutable set search_path = '' as $$
  select p_kind::text in ('medical','counselling','pharmacy','medical_assistant','optician','laboratory')
$$;

create or replace function app.is_medical_kind(p_kind public.station_kind) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_kind::text in ('medical','medical_assistant','optician','laboratory','pharmacy'), false)
$$;

-- Being sent to one of these is itself medical detail.
create or replace function app.is_private_kind(p_kind public.station_kind) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_kind::text in ('optician','laboratory'), false)
$$;

create or replace function app.session_is_medical() returns boolean
language sql stable security definer set search_path = '' as $$ select app.is_medical_kind(app.session_kind()) $$;

create or replace function app.private_stations(p_edition uuid default null) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id), '{}'::uuid[]) from public.stations
  where kind in ('optician','laboratory') and edition_id = coalesce(p_edition, app.session_edition())
$$;

create or replace function app.is_counselling_record(p_kind public.station_kind, p_data jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_kind::text = 'counselling'
      or (p_kind::text = 'prayer' and (p_data->>'counselled' = 'true' or p_data->'outcomes' ? 'Counselled')), false)
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
create or replace function app.has_confidential(p_kind public.confidential_kind, p_visit uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (
      case p_kind::text
        when 'medical' then app.session_is_medical()
        when 'counselling' then app.session_kind()::text = 'counselling'
        when 'spiritual' then app.session_kind()::text in ('prayer','counselling')
        else false
      end
      and exists (select 1 from public.visits v where v.id = p_visit and v.edition_id = app.session_edition())
    )
    or (p_kind::text = 'spiritual' and exists (
      select 1 from public.visits v where v.id = p_visit and app.is_edition_role(v.edition_id, '{super_admin,coordinator}')))
    or exists (
      select 1 from public.break_glass_grants g
      where g.user_id = auth.uid() and g.visit_id = p_visit and g.kind = p_kind and g.expires_at > now()
    )
$$;

drop policy confidential_insert on public.confidential_records;
create policy confidential_insert on public.confidential_records for insert to authenticated
  with check (
    case kind::text
      when 'medical' then (select app.session_kind())::text in ('medical','medical_assistant','optician','laboratory')
      when 'counselling' then (select app.session_kind())::text = 'counselling'
      when 'spiritual' then (select app.session_kind())::text in ('prayer','counselling')
      else false
    end
    and edition_id = (select app.session_edition())
    and exists (select 1 from public.service_records sr
                where sr.id = service_record_id and sr.session_id = (select app.session_id())
                  and sr.visit_id = confidential_records.visit_id)
  );

drop policy needs_select on public.visit_needs;
create policy needs_select on public.visit_needs for select to authenticated
  using (
    app.is_edition_role(edition_id, '{super_admin,coordinator}')
    or (app.is_edition_role(edition_id, '{followup}') and not (station_id = any (app.private_stations(edition_id))))
    or (edition_id = (select app.session_edition())
        and ((select app.session_is_medical()) or not (station_id = any ((select app.private_stations())::uuid[]))))
  );
drop policy needs_insert on public.visit_needs;
create policy needs_insert on public.visit_needs for insert to authenticated
  with check (
    (app.is_edition_role(edition_id, '{super_admin,coordinator}')
     or (edition_id = (select app.session_edition())
         and ((select app.session_is_medical()) or not (station_id = any ((select app.private_stations())::uuid[])))))
    and exists (select 1 from public.visits v where v.id = visit_id and v.edition_id = visit_needs.edition_id)
    and exists (select 1 from public.stations s where s.id = station_id and s.edition_id = visit_needs.edition_id)
  );

drop policy services_select on public.service_records;
create policy services_select on public.service_records for select to authenticated
  using (
    app.is_edition_role(edition_id, '{super_admin,coordinator}')
    or (app.is_edition_role(edition_id, '{followup}') and not (station_id = any (app.private_stations(edition_id))))
    or (edition_id = (select app.session_edition())
        and ((select app.session_is_medical()) or not (station_id = any ((select app.private_stations())::uuid[]))))
  );

drop policy flags_select on public.flags;
create policy flags_select on public.flags for select to authenticated
  using (
    app.is_edition_role(edition_id, '{super_admin,coordinator}')
    or (app.is_edition_role(edition_id, '{followup}') and scope <> 'medical')
    or (edition_id = (select app.session_edition())
        and (scope = 'all'
             or scope::text = (select app.session_kind())::text
             or (scope = 'medical' and (select app.session_is_medical()))
             or (scope = 'leads' and (select app.session_is_lead()))
             or created_by_session = (select app.session_id())))
  );
drop policy flags_insert on public.flags;
create policy flags_insert on public.flags for insert to authenticated
  with check (
    edition_id = (select app.session_edition())
    and created_by_session = (select app.session_id())
    and (scope in ('all','leads') or scope::text = (select app.session_kind())::text
         or (scope = 'medical' and (select app.session_is_medical())))
    and exists (select 1 from public.visits v where v.id = visit_id and v.edition_id = flags.edition_id)
  );

-- ---------------------------------------------------------------------------
-- Referrals
-- ---------------------------------------------------------------------------
create or replace function app.refer_to_station(
  p_edition uuid, p_visit uuid, p_to_station uuid, p_from_station uuid, p_session uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_to text; v_from text; v_private boolean;
begin
  select name into v_to from public.stations where id = p_to_station and edition_id = p_edition;
  if v_to is null then return; end if;
  select name into v_from from public.stations where id = p_from_station;
  -- A lab, optician or lab-result referral is medical detail: only the medical team sees the alert.
  v_private := app.is_private_kind((select kind from public.stations where id = p_to_station))
            or coalesce(app.is_private_kind((select kind from public.stations where id = p_from_station)), false);
  insert into public.visit_needs (visit_id, station_id, edition_id, state, source, state_at)
  values (p_visit, p_to_station, p_edition, 'referred', 'referral:' || p_from_station::text, now())
  on conflict (visit_id, station_id) do update
    set state = case when public.visit_needs.state = 'pending' then 'pending'::public.need_state else 'referred'::public.need_state end,
        source = excluded.source, state_at = now(), declined_reason = null;
  perform app.add_flag(p_edition, p_visit, 'referral', (case when v_private then 'medical' else 'all' end)::public.flag_scope,
    'Referred to ' || v_to || ' by ' || coalesce(v_from, 'another station'), p_session);
end $$;

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

  if p_station = any (app.private_stations(v_edition))
     and not (app.session_is_medical() or app.is_edition_role(v_edition, '{super_admin,coordinator}')) then
    raise exception 'permission_denied' using errcode = '42501', hint = 'Only the medical team can send people there.';
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

-- ---------------------------------------------------------------------------
-- Everyone goes to Medical Assistant, Counselling and Pharmacy
-- ---------------------------------------------------------------------------
create or replace function app.add_compulsory_needs(p_visit uuid, p_edition uuid, p_at timestamptz) returns void
language sql security definer set search_path = '' as $$
  insert into public.visit_needs (visit_id, station_id, edition_id, state, source, state_at)
  select p_visit, s.id, p_edition, 'pending', 'registration', p_at
  from (select distinct on (kind) id from public.stations
        where edition_id = p_edition and enabled and kind in ('medical_assistant','prayer','pharmacy')
        order by kind, sort_order, id) s
  on conflict (visit_id, station_id) do nothing
$$;

create or replace function app.trg_visit_needs() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.add_compulsory_needs(new.id, new.edition_id, new.registered_at);
  return new;
end $$;
create trigger trg_visit_needs after insert on public.visits
  for each row execute function app.trg_visit_needs();

-- ---------------------------------------------------------------------------
-- Pharmacy gate: Counselling first
-- ---------------------------------------------------------------------------
-- Accepts a counselling record that was undone after Pharmacy relied on it
-- (data.counselling_record_id), so a late sync never loses what was dispensed.
create or replace function app.trg_pharmacy_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_override text := new.data->>'override_by';
begin
  if exists (select 1 from public.service_records where id = new.id) then return new; end if;  -- idempotent retry
  if (select kind::text from public.stations where id = new.station_id) is distinct from 'pharmacy' then return new; end if;
  if not exists (select 1 from public.stations where edition_id = new.edition_id and enabled and kind in ('prayer','counselling')) then
    return new;
  end if;

  if exists (
    select 1 from public.service_records sr join public.stations s on s.id = sr.station_id
    where sr.visit_id = new.visit_id and app.is_counselling_record(s.kind, sr.data)
      and (sr.voided_at is null
           or (sr.id::text = new.data->>'counselling_record_id' and sr.voided_at >= new.served_at))
  ) then
    return new;
  end if;

  if v_override is null then
    raise exception 'counselling_required' using errcode = 'P0001',
      hint = 'Counselling is not done yet. Send the person to Counselling first.';
  end if;
  if v_override like 'offline:%' then return new; end if;  -- flagged for review after insert

  begin
    update public.lead_overrides set used_at = now()
    where id = v_override::uuid and station_id = new.station_id and used_at is null
      and created_at > now() - interval '30 minutes';
  exception when invalid_text_representation then
    raise exception 'pharmacy_override_invalid' using errcode = 'P0001';
  end;
  if not found then
    raise exception 'pharmacy_override_invalid' using errcode = 'P0001',
      hint = 'The Station Lead approval has expired. Ask them again.';
  end if;
  return new;
end $$;
create trigger trg_pharmacy_gate before insert on public.service_records
  for each row execute function app.trg_pharmacy_gate();

create or replace function app.trg_service_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.station_kind;
  v_station_name text;
  r record;
  v_ref text;
  v_medical uuid;
begin
  select kind, name into v_kind, v_station_name from public.stations where id = new.station_id;

  -- 1. Need status -> served
  insert into public.visit_needs (visit_id, station_id, edition_id, state, source, state_at)
  values (new.visit_id, new.station_id, new.edition_id, 'served', 'walk_in', new.served_at)
  on conflict (visit_id, station_id) do update
    set state = 'served', state_at = excluded.state_at, declined_reason = null;

  -- 2. Inventory (food / clothing / medical items), aggregated per item
  if jsonb_typeof(new.data->'items') = 'array' then
    for r in
      select (x->>'item_id')::uuid as item_id, sum(greatest(coalesce((x->>'qty')::int, 1), 0))::int as qty
      from jsonb_array_elements(new.data->'items') x
      group by 1
    loop
      if r.qty > 0 and exists (select 1 from public.inventory_items i
                               where i.id = r.item_id and i.edition_id = new.edition_id) then
        insert into public.inventory_movements (id, item_id, delta, reason, service_record_id, session_or_user)
        values (gen_random_uuid(), r.item_id, -r.qty, 'service', new.id, new.session_id)
        on conflict do nothing;
        if found then
          update public.inventory_items set remaining = remaining - r.qty where id = r.item_id;
        end if;
      end if;
    end loop;
  end if;

  -- 3. Follow-ups + flags per station kind
  if v_kind = 'prayer' then
    if new.data->>'decision' in ('salvation','rededication') then
      perform app.add_followup(new.edition_id, new.visit_id, (new.data->>'decision')::public.followup_type, new.id);
    end if;
    if coalesce((new.data->>'wants_followup')::boolean, false) then
      perform app.add_followup(new.edition_id, new.visit_id, 'prayer', new.id);
    end if;
    if coalesce((new.data->>'join_fellowship')::boolean, false) then
      perform app.add_followup(new.edition_id, new.visit_id, 'fellowship', new.id);
    end if;

  elsif v_kind = 'counselling' then
    if coalesce((new.data->>'followup_needed')::boolean, false) then
      perform app.add_followup(new.edition_id, new.visit_id, 'counselling', new.id);
    end if;
    if new.data->>'risk' = 'urgent' then
      perform app.add_followup(new.edition_id, new.visit_id, 'counselling_urgent', new.id);
      perform app.add_flag(new.edition_id, new.visit_id, 'urgent_counselling', 'leads',
        'Urgent counselling: refer to professional. Station Lead notified.', new.session_id);
    elsif new.data->>'risk' = 'pastoral' then
      perform app.add_flag(new.edition_id, new.visit_id, 'pastoral_attention', 'counselling',
        'Needs pastoral attention', new.session_id);
    end if;
    if coalesce((new.data->>'refer_medical')::boolean, false) then
      select id into v_medical from public.stations
      where edition_id = new.edition_id and kind = 'medical' and enabled order by sort_order limit 1;
      if v_medical is not null then
        perform app.refer_to_station(new.edition_id, new.visit_id, v_medical, new.station_id, new.session_id);
      end if;
    end if;

  elsif v_kind = 'medical' then
    if coalesce((new.data->>'referred')::boolean, false) then
      perform app.add_followup(new.edition_id, new.visit_id, 'medical_referral', new.id);
      perform app.add_flag(new.edition_id, new.visit_id, 'hospital_referral',
        case when new.data->>'referral_urgency' = 'urgent' then 'leads'::public.flag_scope else 'medical'::public.flag_scope end,
        case when new.data->>'referral_urgency' = 'urgent' then 'Urgent hospital referral' else 'Hospital referral' end,
        new.session_id);
    end if;

  elsif v_kind = 'pharmacy' then
    if (new.data->>'override_by') is not null then
      perform app.add_flag(new.edition_id, new.visit_id, 'pharmacy_override_review', 'leads',
        'Pharmacy served before Counselling with a Station Lead override. Please review.', new.session_id);
    end if;

  elsif v_kind = 'food' then
    if (new.data->>'override_by') like 'offline:%' then
      perform app.add_flag(new.edition_id, new.visit_id, 'food_override_review', 'leads',
        'Food given again with an offline override. Please review.', new.session_id);
    end if;
  end if;

  -- 4. Generic referrals to other stations
  if jsonb_typeof(new.data->'refer_to_station_ids') = 'array' then
    for v_ref in select jsonb_array_elements_text(new.data->'refer_to_station_ids') loop
      begin
        perform app.refer_to_station(new.edition_id, new.visit_id, v_ref::uuid, new.station_id, new.session_id);
      exception when invalid_text_representation then
        null;
      end;
    end loop;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Side effects of confidential records (so the shared record stays generic)
-- ---------------------------------------------------------------------------
create or replace function app.trg_confidential_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sr public.service_records;
  v_ref text;
  v_doctor uuid;
begin
  select * into sr from public.service_records where id = new.service_record_id;
  if sr.voided_at is not null then return new; end if;

  if new.kind = 'medical' then
    if jsonb_typeof(new.payload->'refer_to_station_ids') = 'array' then
      for v_ref in select jsonb_array_elements_text(new.payload->'refer_to_station_ids') loop
        begin
          perform app.refer_to_station(new.edition_id, new.visit_id, v_ref::uuid, sr.station_id, sr.session_id);
        exception when invalid_text_representation then
          null;
        end;
      end loop;
    end if;
    -- Lab results go back to the doctor's queue.
    if jsonb_typeof(new.payload->'lab_results') = 'array' and jsonb_array_length(new.payload->'lab_results') > 0 then
      select id into v_doctor from public.stations
      where edition_id = new.edition_id and kind = 'medical' and enabled order by sort_order, id limit 1;
      if v_doctor is not null then
        perform app.refer_to_station(new.edition_id, new.visit_id, v_doctor, sr.station_id, sr.session_id);
      end if;
    end if;
    if new.payload->>'minor_surgery' = 'needed' then
      perform app.add_flag(new.edition_id, new.visit_id, 'minor_surgery', 'medical', 'Minor surgery needed', sr.session_id);
    elsif new.payload->>'minor_surgery' = 'done' then
      update public.flags set resolved_at = now()
      where visit_id = new.visit_id and kind = 'minor_surgery' and resolved_at is null;
    end if;

  elsif new.kind = 'spiritual' then
    if new.payload->>'faith' = 'new_convert' then
      perform app.add_followup(new.edition_id, new.visit_id, 'salvation', sr.id);
    end if;
    if new.payload->>'rededicated' = 'true' then
      perform app.add_followup(new.edition_id, new.visit_id, 'rededication', sr.id);
    end if;
    if new.payload->>'wants_followup' = 'true' then
      perform app.add_followup(new.edition_id, new.visit_id, 'prayer', sr.id);
    end if;
    if new.payload->>'join_fellowship' = 'true' then
      perform app.add_followup(new.edition_id, new.visit_id, 'fellowship', sr.id);
    end if;
  end if;
  return new;
end $$;
create trigger trg_confidential_after_insert after insert on public.confidential_records
  for each row execute function app.trg_confidential_after_insert();

-- ---------------------------------------------------------------------------
-- Dashboard numbers
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
  spirit as (select r.visit_id, c.payload from public.confidential_records c join rec r on r.id = c.service_record_id
             where c.kind = 'spiritual'),
  med as (select r.visit_id, r.kind, c.payload from public.confidential_records c join rec r on r.id = c.service_record_id
          where c.kind = 'medical'),
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
      'salvations', ((select count(*) from rec where kind = 'prayer' and data->>'decision' = 'salvation')
        + (select count(*) from spirit where payload->>'faith' = 'new_convert')),
      'rededications', ((select count(*) from rec where kind = 'prayer' and data->>'decision' = 'rededication')
        + (select count(*) from spirit where coalesce((payload->>'rededicated')::boolean, false))),
      'decisions', ((select count(*) from rec where kind = 'prayer' and data->>'decision' in ('salvation','rededication'))
        + (select count(*) from spirit where payload->>'faith' = 'new_convert' or coalesce((payload->>'rededicated')::boolean, false))),
      'referrals', (select count(*) from rec where kind = 'medical' and coalesce((data->>'referred')::boolean, false)),
      'urgent_counselling', (select count(*) from rec where kind = 'counselling' and data->>'risk' = 'urgent'),
      'counselled', (select count(distinct visit_id) from rec where app.is_counselling_record(kind, data)),
      'already_born_again', (select count(distinct visit_id) from spirit where payload->>'faith' = 'born_again'),
      'healings', (select count(distinct visit_id) from spirit where coalesce((payload->>'healing')::boolean, false)),
      'hg_baptised_today', (select count(distinct visit_id) from spirit where payload->>'holy_ghost' = 'today'),
      'hg_baptised_before', (select count(distinct visit_id) from spirit where payload->>'holy_ghost' = 'already'),
      'tongues', (select count(distinct visit_id) from spirit where coalesce((payload->>'tongues')::boolean, false)),
      'minor_surgery', (select count(distinct visit_id) from med where payload->>'minor_surgery' in ('needed','done')),
      'lab_patients', (select count(distinct visit_id) from rec where kind = 'laboratory'),
      'optician_patients', (select count(distinct visit_id) from rec where kind = 'optician'),
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
    from (values ('registration','Registration','ClipboardPen',0), ('medical_assistant','Medical Assistant','HeartPulse',1),
                 ('medical','General Doctor','Stethoscope',2), ('optician','Optician','Glasses',3),
                 ('laboratory','Laboratory','FlaskConical',4), ('prayer','Counselling','HandHeart',5),
                 ('pharmacy','Pharmacy','Pill',7), ('clothing','Clothing','Shirt',8),
                 ('food','Food','UtensilsCrossed',9)) as d(k, n, ic, o);
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Existing editions: rename, add the new stations, reorder, add the compulsory needs
-- ---------------------------------------------------------------------------
do $$
declare e record; k record; v record; v_id uuid;
begin
  -- A closed training edition is upgraded too (and stays closed), so it can be reopened for practice.
  perform set_config('app.allow_closed_write', 'on', true);
  for e in select * from public.editions where status <> 'closed' or is_training loop
    update public.stations set name = 'Counselling (private notes)' where edition_id = e.id and kind = 'counselling' and name = 'Counselling';
    update public.stations set name = 'Counselling' where edition_id = e.id and kind = 'prayer' and name in ('Prayer', 'Prayer & Counselling');
    update public.stations set name = 'General Doctor' where edition_id = e.id and kind = 'medical' and name in ('Medical', 'MMedical');

    for k in select * from (values
        ('medical_assistant','Medical Assistant','HeartPulse','131313','130130'),
        ('optician','Optician','Glasses','141414','140140'),
        ('laboratory','Laboratory','FlaskConical','151515','150150')) as t(kind, name, icon, pin, role_pin)
    loop
      continue when exists (select 1 from public.stations where edition_id = e.id and kind::text = k.kind);
      insert into public.stations (edition_id, kind, name, icon, sort_order, is_service, join_pin_hash, role_pin_hash, lead_pin_hash)
      values (e.id, k.kind::public.station_kind, k.name, k.icon, 50, true,
              app.hash_pin(case when e.is_training then k.pin else app.random_pin() end),
              case when e.is_training then app.hash_pin(k.role_pin) end,
              case when e.is_training then app.hash_pin('999999') end)
      returning id into v_id;
      if e.is_training then
        insert into public.station_secrets (station_id, join_pin_enc, role_pin_enc, lead_pin_enc)
        values (v_id, 'training:' || k.pin, 'training:' || k.role_pin, 'training:999999');
      end if;
    end loop;

    update public.stations set sort_order = case kind::text
      when 'registration' then 0 when 'medical_assistant' then 1 when 'medical' then 2 when 'optician' then 3
      when 'laboratory' then 4 when 'prayer' then 5 when 'counselling' then 6 when 'pharmacy' then 7
      when 'clothing' then 8 when 'food' then 9 when 'custom' then 20 else 30 end
    where edition_id = e.id;

    for v in select id, registered_at from public.visits where edition_id = e.id and status = 'active' and deleted_at is null loop
      perform app.add_compulsory_needs(v.id, e.id, v.registered_at);
    end loop;
  end loop;
  perform set_config('app.allow_closed_write', 'off', true);
end $$;

grant execute on all functions in schema app to authenticated, anon, service_role;
