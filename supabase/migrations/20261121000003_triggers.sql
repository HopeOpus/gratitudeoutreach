-- Triggers: updated_at, closed-edition lock, cards, inventory, service side-effects,
-- food duplicate guard, audit. See docs/Architecture.md §5.

-- ---------------------------------------------------------------------------
-- updated_at (drives delta sync)
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','editions','stations','volunteer_sessions','cards','beneficiaries','visits',
    'visit_needs','service_records','flags','inventory_items','followups','station_secrets'
  ] loop
    execute format('create trigger trg_touch_updated_at before update on public.%I
                    for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Closed editions are read-only (FR-1.6)
-- ---------------------------------------------------------------------------
create or replace function app.assert_edition_writable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_status public.edition_status;
begin
  if coalesce(current_setting('app.allow_closed_write', true), '') = 'on' then
    return new;
  end if;
  select status into v_status from public.editions where id = new.edition_id;
  if v_status = 'closed' then
    raise exception 'edition_closed' using errcode = 'P0001', hint = 'This edition is closed and read-only.';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['visits','visit_needs','service_records','confidential_records','flags'] loop
    execute format('create trigger trg_assert_writable before insert or update on public.%I
                    for each row execute function app.assert_edition_writable()', t);
  end loop;
end $$;

-- Reopening a closed edition needs a Super Admin; keep closed_at in step.
create or replace function app.trg_edition_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'closed' and new.status <> 'closed'
     and coalesce(auth.role(), '') <> 'service_role'
     and not app.is_org_member(new.org_id, '{super_admin}') then
    raise exception 'only_super_admin_can_reopen' using errcode = '42501';
  end if;
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end $$;
create trigger trg_edition_status before update of status on public.editions
  for each row execute function app.trg_edition_status();

-- ---------------------------------------------------------------------------
-- Cards: assigning a code to a visit marks the card assigned
-- ---------------------------------------------------------------------------
create or replace function app.trg_visit_card() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_card public.cards;
begin
  if new.card_code is null then return new; end if;
  if tg_op = 'UPDATE' and new.card_code is not distinct from old.card_code then return new; end if;

  select * into v_card from public.cards where edition_id = new.edition_id and code = new.card_code;
  if found then
    if v_card.status = 'void' then
      raise exception 'card_void' using errcode = '23505', hint = 'This card was voided.';
    elsif v_card.status = 'assigned' and v_card.visit_id is distinct from new.id then
      raise exception 'card_conflict' using errcode = '23505', hint = 'Card already assigned.';
    end if;
    update public.cards set status = 'assigned', visit_id = new.id where id = v_card.id;
  end if;
  return new;
end $$;
create trigger trg_visit_card after insert or update of card_code on public.visits
  for each row execute function app.trg_visit_card();

-- ---------------------------------------------------------------------------
-- Inventory: remaining follows opening_qty edits
-- ---------------------------------------------------------------------------
create or replace function app.trg_inventory_opening() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.remaining := new.opening_qty;
  elsif new.opening_qty <> old.opening_qty then
    new.remaining := old.remaining + (new.opening_qty - old.opening_qty);
  end if;
  return new;
end $$;
create trigger trg_inventory_opening before insert or update of opening_qty on public.inventory_items
  for each row execute function app.trg_inventory_opening();

-- ---------------------------------------------------------------------------
-- Food duplicate guard (FR-6.4)
-- ---------------------------------------------------------------------------
create or replace function app.trg_food_duplicate_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.station_kind;
  v_override text;
  v_override_id uuid;
begin
  -- Idempotent retry of an already-synced record: let ON CONFLICT skip it.
  if exists (select 1 from public.service_records where id = new.id) then return new; end if;

  select kind into v_kind from public.stations where id = new.station_id;
  if v_kind <> 'food' then return new; end if;

  if not exists (
    select 1 from public.service_records sr
    join public.stations s on s.id = sr.station_id
    where sr.visit_id = new.visit_id and s.kind = 'food' and sr.voided_at is null
  ) then
    return new;
  end if;

  v_override := new.data->>'override_by';
  if v_override is null then
    raise exception 'food_duplicate' using errcode = 'P0001',
      hint = 'Already collected food this edition. A Station Lead override is needed.';
  end if;

  if v_override like 'offline:%' then
    return new;  -- accepted; a leads flag is raised after insert for review
  end if;

  begin
    v_override_id := v_override::uuid;
  exception when invalid_text_representation then
    raise exception 'food_override_invalid' using errcode = 'P0001';
  end;

  update public.lead_overrides set used_at = now()
  where id = v_override_id and station_id = new.station_id and used_at is null
    and created_at > now() - interval '30 minutes';
  if not found then
    raise exception 'food_override_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_food_duplicate_guard before insert on public.service_records
  for each row execute function app.trg_food_duplicate_guard();

-- ---------------------------------------------------------------------------
-- Service after-insert: needs, inventory, follow-ups, referrals, flags
-- ---------------------------------------------------------------------------
create or replace function app.add_followup(
  p_edition uuid, p_visit uuid, p_type public.followup_type, p_source uuid, p_preferred text default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.followups (edition_id, visit_id, type, source_service_record_id, preferred_time, due_on)
  values (p_edition, p_visit, p_type, p_source, p_preferred, (now() at time zone 'Africa/Lagos')::date + 7)
  on conflict (source_service_record_id, type) do nothing;
$$;

create or replace function app.add_flag(
  p_edition uuid, p_visit uuid, p_kind text, p_scope public.flag_scope, p_text text, p_session uuid
) returns void language sql security definer set search_path = '' as $$
  insert into public.flags (id, edition_id, visit_id, kind, scope, text, created_by_session)
  values (gen_random_uuid(), p_edition, p_visit, p_kind, p_scope, left(p_text, 200), p_session);
$$;

create or replace function app.refer_to_station(
  p_edition uuid, p_visit uuid, p_to_station uuid, p_from_station uuid, p_session uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_to text; v_from text;
begin
  select name into v_to from public.stations where id = p_to_station and edition_id = p_edition;
  if v_to is null then return; end if;
  select name into v_from from public.stations where id = p_from_station;
  insert into public.visit_needs (visit_id, station_id, edition_id, state, source, state_at)
  values (p_visit, p_to_station, p_edition, 'referred', 'referral:' || p_from_station::text, now())
  on conflict (visit_id, station_id) do update
    set state = case when public.visit_needs.state = 'pending' then 'pending'::public.need_state else 'referred'::public.need_state end,
        source = excluded.source, state_at = now(), declined_reason = null;
  perform app.add_flag(p_edition, p_visit, 'referral', 'all',
    'Referred to ' || v_to || ' by ' || coalesce(v_from, 'another station'), p_session);
end $$;

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
create trigger trg_service_after_insert after insert on public.service_records
  for each row execute function app.trg_service_after_insert();

-- Voiding a service record returns its stock and re-opens the need if nothing else served it.
create or replace function app.trg_service_void() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if old.voided_at is null and new.voided_at is not null then
    for r in select item_id, delta from public.inventory_movements
             where service_record_id = new.id and reason = 'service' loop
      insert into public.inventory_movements (id, item_id, delta, reason, service_record_id, session_or_user)
      values (gen_random_uuid(), r.item_id, -r.delta, 'void', new.id, new.voided_by)
      on conflict do nothing;
      if found then
        update public.inventory_items set remaining = remaining - r.delta where id = r.item_id;
      end if;
    end loop;
    if not exists (select 1 from public.service_records
                   where visit_id = new.visit_id and station_id = new.station_id
                     and voided_at is null and id <> new.id) then
      update public.visit_needs set state = 'pending', state_at = now()
      where visit_id = new.visit_id and station_id = new.station_id and state = 'served';
    end if;
  end if;
  return new;
end $$;
create trigger trg_service_void after update of voided_at on public.service_records
  for each row execute function app.trg_service_void();

-- ---------------------------------------------------------------------------
-- Audit log (FR-14.1)
-- ---------------------------------------------------------------------------
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
  v_strip text[] := array['join_pin_hash','role_pin_hash','lead_pin_hash','payload','full_name_search','field_updated_at'];
begin
  if tg_op in ('UPDATE','DELETE') then v_before := to_jsonb(old) - v_strip; end if;
  if tg_op in ('INSERT','UPDATE') then v_after := to_jsonb(new) - v_strip; end if;
  if tg_op = 'UPDATE' and (v_before - 'updated_at') = (v_after - 'updated_at') then
    return new;
  end if;
  begin
    v_id := coalesce(v_after->>'id', v_before->>'id', v_after->>'service_record_id', v_before->>'service_record_id')::uuid;
  exception when others then v_id := null;
  end;
  insert into public.audit_log (actor_user, actor_session, action, table_name, row_id, before, after)
  values (auth.uid(), app.session_id(), lower(tg_op), tg_table_name, v_id, v_before, v_after);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','org_members','editions','stations','cards','beneficiaries','visits',
    'service_records','confidential_records','inventory_items','followups'
  ] loop
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row()', t);
  end loop;
end $$;
