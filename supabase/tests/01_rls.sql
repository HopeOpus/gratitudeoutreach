-- RLS matrix tests (docs/DataModel.md §4). Every ❌ cell must be denied and
-- service_records inserts are "own station only".
begin;
create extension if not exists pgtap with schema extensions;
-- Counselling is switched off by default (part of Prayer & Counselling); these tests exercise the optional private-notes station.
update public.stations set enabled = true where kind = 'counselling';

-- ---------------------------------------------------------------------------
-- Helpers: run SQL as a given user (role authenticated) or as anon
-- ---------------------------------------------------------------------------
create schema t;
grant usage on schema t to authenticated, anon;

create function t.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function t.cnt(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform t.login(p_uid);
  execute 'select count(*) from (' || p_sql || ') x' into n;
  execute 'reset role';
  return n;
end $$;

create function t.run(p_uid uuid, p_sql text) returns void language plpgsql as $$
begin
  perform t.login(p_uid);
  execute p_sql;
  execute 'reset role';
end $$;

create function t.val(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform t.login(p_uid);
  execute p_sql into v;
  execute 'reset role';
  return v;
end $$;

create function t.anon_cnt(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  execute 'select count(*) from (' || p_sql || ') x' into n;
  execute 'reset role';
  return n;
end $$;

create function t.new_user() returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, is_anonymous, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', true, now(), now());
  return v;
end $$;

grant execute on all functions in schema t to authenticated, anon;

-- Fixture ids
create table t.ids (k text primary key, v uuid);
grant select on t.ids to authenticated, anon;
insert into t.ids values
  ('none', t.new_user()), ('food', t.new_user()), ('med', t.new_user()), ('couns', t.new_user()),
  ('reg', t.new_user()), ('prayer', t.new_user()), ('brute', t.new_user()), ('lead', t.new_user()),
  ('super', '00000000-0000-4000-8000-00000000ad01'), ('coord', '00000000-0000-4000-8000-00000000ad02'),
  ('followup', '00000000-0000-4000-8000-00000000ad03'), ('viewer', '00000000-0000-4000-8000-00000000ad04'),
  ('tr', '00000000-0000-4000-8000-0000000000e1');
create function t.id(p text) returns uuid language sql stable as $$ select v from t.ids where k = p $$;
grant execute on function t.id(text) to authenticated, anon;

-- A visit that has a medical confidential record, and one with counselling
insert into t.ids select 'med_visit', visit_id from public.confidential_records where kind = 'medical' limit 1;
insert into t.ids select 'couns_visit', visit_id from public.confidential_records where kind = 'counselling' limit 1;
-- A visit with no food record yet
insert into t.ids select 'nofood_visit', v.id from public.visits v
  where v.edition_id = t.id('tr') and not exists (
    select 1 from public.service_records r join public.stations s on s.id = r.station_id
    where r.visit_id = v.id and s.kind = 'food') limit 1;

select plan(61);

-- ---------------------------------------------------------------------------
-- 1. Join flow
-- ---------------------------------------------------------------------------
select is(t.val(t.id('none'), $$select public.join_station('000000', 'X', '+2348100000001')$$)->>'error', 'invalid_pin', 'wrong PIN is rejected');
select is(t.val(t.id('food'), $$select public.join_station('555555', 'Kunle', '+2348100000002')$$)->'session'->>'role', 'volunteer', 'food volunteer joins with PIN');
select is(t.val(t.id('med'), $$select public.join_station('444444', 'Dr Ada', '+2348100000003', null, 'Dr')$$)->>'error', 'invalid_role_pin', 'medical without role PIN is rejected');
select is(t.val(t.id('med'), $$select public.join_station('444444', 'Dr Ada', '+2348100000004', '404040', 'Dr', null, false)$$)->>'error', 'confidential_ack_required', 'medical needs confidentiality acknowledgement');
select ok(t.val(t.id('med'), $$select public.join_station('444444', 'Dr Ada', '+2348100000005', '404040', 'Dr', null, true)$$) ? 'session', 'medical joins with role PIN + ack');
select ok(t.val(t.id('couns'), $$select public.join_station('333333', 'Bro Femi', '+2348100000006', '303030', null, null, true)$$) ? 'session', 'counsellor joins');
select ok(t.val(t.id('reg'), $$select public.join_station('111111', 'Tobi', '+2348012345678')$$) ? 'session', 'registration joins');
select ok(t.val(t.id('prayer'), $$select public.join_station('222222', 'Ngozi', '+2348100000007')$$) ? 'session', 'prayer joins');
select is(t.val(t.id('lead'), $$select public.join_station('555555', 'Lead', '+2348100000008', '999999')$$)->'session'->>'role', 'station_lead', 'lead PIN gives station_lead role');
select is(t.val(t.id('food'), $$select public.join_station('555555', '', '+2348100000009')$$)->>'error', 'name_required', 'name is required');

-- Rate limit: 5 failures lock the user out (even with the right PIN)
select t.val(t.id('brute'), $$select public.join_station('000001', 'B', '+2348100000010')$$);
select t.val(t.id('brute'), $$select public.join_station('000002', 'B', '+2348100000011')$$);
select t.val(t.id('brute'), $$select public.join_station('000003', 'B', '+2348100000012')$$);
select t.val(t.id('brute'), $$select public.join_station('000004', 'B', '+2348100000013')$$);
select t.val(t.id('brute'), $$select public.join_station('000005', 'B', '+2348100000014')$$);
select is(t.val(t.id('brute'), $$select public.join_station('555555', 'B', '+2348100000015')$$)->>'error', 'locked', '6th attempt after 5 failures is locked');

-- ---------------------------------------------------------------------------
-- 2. No session = no data
-- ---------------------------------------------------------------------------
select is(t.cnt(t.id('none'), 'select 1 from public.beneficiaries'), 0::bigint, 'no session: beneficiaries hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.visits'), 0::bigint, 'no session: visits hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.service_records'), 0::bigint, 'no session: service_records hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.confidential_records'), 0::bigint, 'no session: confidential hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.editions'), 0::bigint, 'no session: editions hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.stations_public'), 0::bigint, 'no session: stations hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.flags'), 0::bigint, 'no session: flags hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.inventory_items'), 0::bigint, 'no session: inventory hidden');
select is(t.cnt(t.id('none'), 'select 1 from public.cards'), 0::bigint, 'no session: cards hidden');
select throws_ok($$select t.anon_cnt('select 1 from public.beneficiaries')$$, '42501', null, 'anon role: permission denied on beneficiaries');
select throws_ok($$select t.anon_cnt('select 1 from public.visits')$$, '42501', null, 'anon role: permission denied on visits');

-- ---------------------------------------------------------------------------
-- 3. Food session
-- ---------------------------------------------------------------------------
select is(t.cnt(t.id('food'), 'select 1 from public.visits'), 300::bigint, 'food: reads all visits in edition');
select ok(t.cnt(t.id('food'), 'select 1 from public.service_records') > 0, 'food: reads service records');
select is(t.cnt(t.id('food'), 'select 1 from public.confidential_records'), 0::bigint, 'food: CANNOT read confidential_records');
select is(t.cnt(t.id('food'), 'select 1 from public.followups'), 0::bigint, 'food: cannot read followups');
select is(t.cnt(t.id('food'), 'select 1 from public.audit_log'), 0::bigint, 'food: cannot read audit_log');
select is(t.cnt(t.id('food'), $$select 1 from public.flags where scope in ('medical','counselling','leads')$$), 0::bigint, 'food: cannot read medical/counselling/leads flags');
select is(t.cnt(t.id('food'), 'select 1 from public.volunteer_sessions'), 1::bigint, 'food: sees only own session');
select throws_ok($$select t.cnt(t.id('food'), 'select join_pin_hash from public.stations')$$, '42501', null, 'food: PIN hashes not selectable');
select throws_ok($$select t.cnt(t.id('food'), 'select 1 from public.station_secrets')$$, '42501', null, 'food: station_secrets denied');
select throws_ok($$select t.run(t.id('food'), $q$insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at)
  select gen_random_uuid(), t.id('tr'), t.id('nofood_visit'), s.id, app.session_id(), 'K', 'x', now()
  from public.stations_public s where s.edition_id = t.id('tr') and s.kind = 'prayer'$q$)$$, '42501', null, 'food: cannot insert a record for another station');
select lives_ok($$select t.run(t.id('food'), $q$insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at, data)
  values (gen_random_uuid(), t.id('tr'), t.id('nofood_visit'), app.session_station(), app.session_id(), 'Kunle', 'Family food pack ×1', now(),
    jsonb_build_object('items', jsonb_build_array(jsonb_build_object('item_id',
      (select id from public.inventory_items where name = 'Family food pack' and edition_id = t.id('tr')), 'qty', 1))))$q$)$$,
  'food: inserts a record for own station');
select throws_ok($$select t.run(t.id('food'), $q$insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at)
  values (gen_random_uuid(), t.id('tr'), t.id('nofood_visit'), app.session_station(), app.session_id(), 'Kunle', 'again', now())$q$)$$,
  'P0001', 'food_duplicate', 'food: duplicate guard blocks a second food record');
select throws_ok($$select t.run(t.id('food'), $q$insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
  select id, edition_id, visit_id, 'medical', '{}' from public.service_records where session_id = app.session_id() limit 1$q$)$$,
  '42501', null, 'food: cannot insert confidential records');
select throws_ok($$select t.run(t.id('food'), $q$insert into public.visits (id, edition_id, beneficiary_id, registered_at, consent_data_at, consent_version)
  select gen_random_uuid(), t.id('tr'), id, now(), now(), 1 from public.beneficiaries limit 1$q$)$$,
  '42501', null, 'food: cannot register visits');
select throws_ok($$select t.val(t.id('food'), 'select public.dashboard_stats(t.id(''tr''))')$$, '42501', null, 'food: dashboard_stats denied');

-- Inventory decrement + need served happened via trigger
select is((select remaining from public.inventory_items where name = 'Family food pack' and edition_id = t.id('tr')),
  (select opening_qty - coalesce(-sum(m.delta), 0)::int from public.inventory_items i left join public.inventory_movements m on m.item_id = i.id
   where i.name = 'Family food pack' and i.edition_id = t.id('tr') group by i.opening_qty), 'inventory remaining = opening + movements');
select is((select state::text from public.visit_needs n join public.stations s on s.id = n.station_id
           where n.visit_id = t.id('nofood_visit') and s.kind = 'food'), 'served', 'service marks need served');

-- ---------------------------------------------------------------------------
-- 4. Confidential separation
-- ---------------------------------------------------------------------------
select ok(t.cnt(t.id('med'), $$select 1 from public.confidential_records where kind = 'medical'$$) > 0, 'medical: reads medical confidential');
select is(t.cnt(t.id('med'), $$select 1 from public.confidential_records where kind = 'counselling'$$), 0::bigint, 'medical: CANNOT read counselling payloads');
select ok(t.cnt(t.id('couns'), $$select 1 from public.confidential_records where kind = 'counselling'$$) > 0, 'counselling: reads counselling confidential');
select is(t.cnt(t.id('couns'), $$select 1 from public.confidential_records where kind = 'medical'$$), 0::bigint, 'counselling: CANNOT read medical payloads');
select is(t.cnt(t.id('prayer'), $$select 1 from public.confidential_records where kind <> 'spiritual'$$), 0::bigint, 'counselling station: reads no medical or private counselling notes');
select is(t.cnt(t.id('coord'), $$select 1 from public.confidential_records where kind <> 'spiritual'$$), 0::bigint, 'coordinator: no medical or counselling notes by default');
select is(t.cnt(t.id('super'), $$select 1 from public.confidential_records where kind <> 'spiritual'$$), 0::bigint, 'super admin: no medical or counselling notes by default');
select throws_ok($$select t.val(t.id('coord'), $q$select public.break_glass('medical', t.id('med_visit'), 'short')$q$)$$, '22023', null, 'break-glass needs a real reason');
select ok(t.val(t.id('coord'), $q$select public.break_glass('medical', t.id('med_visit'), 'Hospital requested referral details')$q$) ? 'expires_at', 'coordinator break-glass granted');
select ok(t.cnt(t.id('coord'), $$select 1 from public.confidential_records where visit_id = t.id('med_visit') and kind = 'medical'$$) > 0, 'break-glass: medical record visible for that visit');
select is(t.cnt(t.id('coord'), $$select 1 from public.confidential_records where kind = 'counselling'$$), 0::bigint, 'break-glass: counselling still hidden');
select ok(exists (select 1 from public.audit_log where action = 'break_glass' and row_id = t.id('med_visit')), 'break-glass is audited');

-- ---------------------------------------------------------------------------
-- 5. Admin roles
-- ---------------------------------------------------------------------------
select is(t.cnt(t.id('viewer'), 'select 1 from public.beneficiaries'), 0::bigint, 'viewer: no beneficiaries (aggregates only)');
select is(t.cnt(t.id('viewer'), 'select 1 from public.service_records'), 0::bigint, 'viewer: no service records');
select is(t.cnt(t.id('viewer'), 'select 1 from public.flags'), 0::bigint, 'viewer: no flags');
select is(t.cnt(t.id('viewer'), 'select 1 from public.followups'), 0::bigint, 'viewer: no followups');
select ok((t.val(t.id('viewer'), $$select public.dashboard_stats(t.id('tr'))$$)->'kpis'->>'registered')::int >= 300, 'viewer: dashboard aggregates allowed');
select is(t.cnt(t.id('followup'), 'select 1 from public.inventory_items'), 0::bigint, 'followup: no inventory');
select is(t.cnt(t.id('followup'), 'select 1 from public.audit_log'), 0::bigint, 'followup: no audit log');
select ok(t.cnt(t.id('followup'), 'select 1 from public.followups') > 0, 'followup: reads followups');
select is(t.cnt(t.id('coord'), 'select 1 from public.audit_log'), 0::bigint, 'coordinator: audit log is super-admin only');
select ok(t.cnt(t.id('super'), 'select 1 from public.audit_log') > 0, 'super admin: reads audit log');

select * from finish();
rollback;
