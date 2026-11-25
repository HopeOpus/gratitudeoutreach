-- Patient flow (migration 013): compulsory needs, Counselling before Pharmacy, shared medical record, private referrals.
begin;
create extension if not exists pgtap with schema extensions;

create schema t;
grant usage on schema t to authenticated;
create function t.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function t.run(p_uid uuid, p_sql text) returns void language plpgsql as $$
begin perform t.login(p_uid); execute p_sql; execute 'reset role'; end $$;
create function t.val(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb; begin perform t.login(p_uid); execute p_sql into v; execute 'reset role'; return v; end $$;
create function t.new_user() returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, is_anonymous, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', true, now(), now());
  return v;
end $$;
create table t.ids (k text primary key, v uuid);
create function t.id(p text) returns uuid language sql stable as $$ select v from t.ids where k = p $$;
grant select on t.ids to authenticated;
grant execute on all functions in schema t to authenticated;

create function t.cnt(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin perform t.login(p_uid); execute 'select count(*) from (' || p_sql || ') x' into v; execute 'reset role'; return v; end $$;
-- Saves a service record (and optional confidential payload) as that volunteer.
create function t.serve(p_uid uuid, p_rec uuid, p_data jsonb, p_kind text default null, p_payload jsonb default null) returns void language plpgsql as $$
begin
  perform t.login(p_uid);
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, has_confidential, served_at)
  values (p_rec, app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'V', 'Record', p_data, p_kind is not null, now())
  on conflict (id) do nothing;
  if p_kind is not null then
    insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
    values (p_rec, app.session_edition(), t.id('visit'), p_kind::public.confidential_kind, p_payload) on conflict (service_record_id) do nothing;
  end if;
  execute 'reset role';
end $$;
grant execute on all functions in schema t to authenticated;

insert into t.ids select k, t.new_user() from unnest(array['reg','ma','doc','opt','lab','couns','pharm','pharm_lead','food']) k;
insert into t.ids select k, gen_random_uuid() from unnest(array['ben','visit','r_ma','r_doc','r_lab','r_opt','r_couns','r_ph','r_ph2','r_couns2']) k;
insert into t.ids values ('tr', '00000000-0000-4000-8000-0000000000e1'), ('coord', '00000000-0000-4000-8000-00000000ad02'), ('fu', '00000000-0000-4000-8000-00000000ad03');
insert into t.ids select 'st_' || kind::text, id from public.stations where edition_id = t.id('tr');

select plan(41);

select is(t.val(t.id('ma'), $$select public.join_station('131313', 'Joy', '+2348110000001')$$)->>'error', 'invalid_role_pin', 'Medical Assistant needs a role PIN');
select ok(t.val(t.id('ma'), $$select public.join_station('131313', 'Joy', '+2348110000001', '130130', null, null, true)$$) ? 'session', 'Medical Assistant joins');
select ok(t.val(t.id('opt'), $$select public.join_station('141414', 'Uche', '+2348110000002', '140140', null, null, true)$$) ? 'session', 'Optician joins');
select ok(t.val(t.id('lab'), $$select public.join_station('151515', 'Sani', '+2348110000003', '150150', null, null, true)$$) ? 'session', 'Laboratory joins');
select t.val(t.id('doc'), $$select public.join_station('444444', 'Amina', '+2348110000004', '404040', 'Dr', null, true)$$);
select t.val(t.id('pharm'), $$select public.join_station('777777', 'Bayo', '+2348110000005', '707070', null, null, true)$$);
select t.val(t.id('couns'), $$select public.join_station('222222', 'Ngozi', '+2348110000006')$$);
select t.val(t.id('food'), $$select public.join_station('555555', 'Kunle', '+2348110000007')$$);
select t.val(t.id('reg'), $$select public.join_station('111111', 'Tobi', '+2348110000008')$$);

-- Registration adds the compulsory needs
select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.beneficiaries (id, org_id, full_name, gender, age_range) values (t.id('ben'), app.session_org(), 'Flow Person', 'female', '36-59');
  insert into public.visits (id, edition_id, beneficiary_id, registered_by_session, registered_at, consent_data_at, consent_version)
  values (t.id('visit'), app.session_edition(), t.id('ben'), app.session_id(), now(), now(), 1);
  insert into public.visit_needs (visit_id, station_id, edition_id) values (t.id('visit'), t.id('st_pharmacy'), app.session_edition()) on conflict (visit_id, station_id) do nothing;
$q$)$$, 'registration works with compulsory needs');
select is((select array_agg(s.kind::text order by s.sort_order) from public.visit_needs n join public.stations s on s.id = n.station_id where n.visit_id = t.id('visit')),
  array['medical_assistant','prayer','pharmacy'], 'everyone gets Medical Assistant, Counselling and Pharmacy');

-- Vitals are one shared medical record
select lives_ok($$select t.serve(t.id('ma'), t.id('r_ma'), '{}', 'medical', '{"vitals":{"bp_sys":150,"bp_dia":95}}')$$, 'Medical Assistant saves vitals');
select lives_ok($$select t.serve(t.id('ma'), t.id('r_ma'), '{}', 'medical', '{"vitals":{"bp_sys":150,"bp_dia":95}}')$$, 'a retry is a no-op');
select is(t.cnt(t.id('doc'), $$select 1 from public.confidential_records where service_record_id = t.id('r_ma')$$), 1::bigint, 'doctor reads the vitals');
select is(t.cnt(t.id('lab'), $$select 1 from public.confidential_records where service_record_id = t.id('r_ma')$$), 1::bigint, 'lab reads the vitals');
select is(t.cnt(t.id('couns'), $$select 1 from public.confidential_records where kind = 'medical'$$), 0::bigint, 'Counselling cannot read medical records');
select is(t.cnt(t.id('food'), $$select 1 from public.confidential_records$$), 0::bigint, 'Food reads nothing confidential');

-- Doctor: tests, optician, minor surgery. Nothing leaks to other stations.
select lives_ok($$select t.serve(t.id('doc'), t.id('r_doc'), '{"tests":[],"referred":false,"items":[]}', 'medical',
  jsonb_build_object('tests_requested', '["PCV"]'::jsonb, 'minor_surgery', 'needed', 'refer_to_station_ids', jsonb_build_array(t.id('st_laboratory'), t.id('st_optician'))))$$, 'doctor requests tests and refers');
select is((select state::text from public.visit_needs where visit_id = t.id('visit') and station_id = t.id('st_laboratory')), 'referred', 'waiting at the Laboratory');
select is(t.cnt(t.id('lab'), $$select 1 from public.visit_needs where visit_id = t.id('visit') and station_id = t.id('st_laboratory')$$), 1::bigint, 'lab sees its queue');
select is(t.cnt(t.id('opt'), $$select 1 from public.flags where visit_id = t.id('visit') and kind = 'minor_surgery'$$), 1::bigint, 'medical team sees the minor surgery alert');
select is(t.cnt(t.id('food'), $$select 1 from public.visit_needs where station_id in (t.id('st_laboratory'), t.id('st_optician'))$$), 0::bigint, 'Food cannot see lab or optician needs');
select is(t.cnt(t.id('couns'), $$select 1 from public.flags where visit_id = t.id('visit')$$), 0::bigint, 'Counselling sees no medical alerts');
select is(t.cnt(t.id('fu'), $$select 1 from public.visit_needs where station_id = t.id('st_laboratory')$$), 0::bigint, 'the follow-up team cannot see lab needs');
select throws_ok($$select t.run(t.id('food'), $q$select public.set_need(t.id('visit'), t.id('st_laboratory'), 'referred')$q$)$$, '42501', null, 'Food cannot send people to the Laboratory');
select throws_ok($$select t.run(t.id('food'), $q$insert into public.visit_needs (visit_id, station_id, edition_id) values (t.id('visit'), t.id('st_optician'), app.session_edition())$q$)$$, '42501', null, 'nor insert that need directly');

-- Lab results return to the doctor
select lives_ok($$select t.serve(t.id('lab'), t.id('r_lab'), '{}', 'medical', '{"lab_results":[{"test":"PCV","result":"38","abnormal":false}]}')$$, 'lab saves results');
select is((select state::text from public.visit_needs where visit_id = t.id('visit') and station_id = t.id('st_medical')), 'referred', 'the person is back in the doctor''s queue');
select is(t.cnt(t.id('doc'), $$select 1 from public.confidential_records where service_record_id = t.id('r_lab')$$), 1::bigint, 'doctor reads the results');
select is(t.cnt(t.id('food'), $$select 1 from public.service_records where id = t.id('r_lab')$$), 0::bigint, 'Food cannot see the lab visit');
select is(t.cnt(t.id('couns'), $$select 1 from public.flags where visit_id = t.id('visit')$$), 0::bigint, 'the lab-result alert stays with the medical team');
select lives_ok($$select t.serve(t.id('opt'), t.id('r_opt'), '{}', 'medical', '{"eye":{"va_right":"6/9","outcomes":[]}}')$$, 'optician saves an eye check');
select throws_ok($$select t.serve(t.id('pharm'), gen_random_uuid(), '{}', 'medical', '{}')$$, 'P0001', null, 'pharmacy is blocked before Counselling');

-- Pharmacy gate
select throws_ok($$select t.serve(t.id('pharm'), t.id('r_ph'), '{"items":[]}')$$, 'P0001', 'counselling_required', 'no Counselling: Pharmacy cannot save');
select t.serve(t.id('couns'), t.id('r_couns'), '{"outcomes":["Prayed for"]}');
select throws_ok($$select t.serve(t.id('pharm'), t.id('r_ph'), '{"items":[]}')$$, 'P0001', 'counselling_required', 'prayer alone does not open Pharmacy');
select throws_ok($$select t.serve(t.id('pharm'), t.id('r_ph'), jsonb_build_object('items', '[]'::jsonb, 'override_by', gen_random_uuid()))$$, 'P0001', 'pharmacy_override_invalid', 'a made-up approval is refused');
insert into t.ids select 'ovr', (t.val(t.id('pharm'), $$select public.request_lead_override('999999')$$)->>'override_id')::uuid;
select lives_ok($$select t.serve(t.id('pharm'), t.id('r_ph'), jsonb_build_object('items', '[]'::jsonb, 'override_by', t.id('ovr')))$$, 'a Station Lead approval works');
select throws_ok($$select t.serve(t.id('pharm'), gen_random_uuid(), jsonb_build_object('items', '[]'::jsonb, 'override_by', t.id('ovr')))$$, 'P0001', 'pharmacy_override_invalid', 'an approval works once');
select is((select count(*)::int from public.flags where visit_id = t.id('visit') and kind = 'pharmacy_override_review' and scope = 'leads'), 1, 'the override is flagged for review');

-- Counselling: spiritual outcomes are private, follow-ups and dashboard still work
select lives_ok($$select t.serve(t.id('couns'), t.id('r_couns2'), '{"counselled":true}', 'spiritual',
  '{"faith":"new_convert","holy_ghost":"today","healing":true,"tongues":false,"wants_followup":true}')$$, 'Counselling completes');
select is((select array_agg(type::text order by type::text) from public.followups where visit_id = t.id('visit')), array['prayer','salvation'], 'a New Convert gets follow-ups');
select is(t.cnt(t.id('food'), $$select 1 from public.confidential_records where kind = 'spiritual'$$) + t.cnt(t.id('pharm'), $$select 1 from public.confidential_records where kind = 'spiritual'$$), 0::bigint, 'Food and Pharmacy cannot read spiritual outcomes');
select is(t.cnt(t.id('coord'), $$select 1 from public.confidential_records where service_record_id = t.id('r_couns2')$$), 1::bigint, 'the coordinator can');
select is(t.cnt(t.id('coord'), $$select 1 from public.confidential_records where kind = 'medical'$$), 0::bigint, 'but not medical records');
select lives_ok($$select t.serve(t.id('pharm'), t.id('r_ph2'), '{"items":[]}')$$, 'Pharmacy opens after Counselling');
select ok((select (k->>'counselled')::int > 0 and (k->>'hg_baptised_today')::int > 0 and (k->>'healings')::int > 0 and (k->>'minor_surgery')::int = 1 and (k->>'salvations')::int > 0
  from (select t.val(t.id('coord'), $$select public.dashboard_stats(t.id('tr'))$$)->'kpis' as k) x), 'dashboard counts the new outcomes');

select * from finish();
rollback;
