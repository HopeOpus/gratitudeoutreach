-- Server logic: triggers and RPCs (BuildPlan Phase 1/5 acceptance).
begin;
create extension if not exists pgtap with schema extensions;
-- Counselling is switched off by default (part of Prayer & Counselling); these tests exercise the optional private-notes station.
update public.stations set enabled = true where kind = 'counselling';

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

insert into t.ids values ('reg', t.new_user()), ('prayer', t.new_user()), ('couns', t.new_user()), ('med', t.new_user()),
  ('lead', t.new_user()), ('coord', '00000000-0000-4000-8000-00000000ad02'), ('tr', '00000000-0000-4000-8000-0000000000e1'),
  ('ben', gen_random_uuid()), ('visit', gen_random_uuid()), ('rec_prayer', gen_random_uuid()), ('rec_couns', gen_random_uuid()),
  ('rec_med', gen_random_uuid());
insert into t.ids select 'paracetamol', id from public.inventory_items where name = 'Paracetamol 500mg' and edition_id = t.id('tr');
insert into t.ids select 'medical_station', id from public.stations where kind = 'medical' and edition_id = t.id('tr');
insert into t.ids select 'food_station', id from public.stations where kind = 'food' and edition_id = t.id('tr');

select t.val(t.id('reg'), $$select public.join_station('111111', 'Tobi')$$);
select t.val(t.id('prayer'), $$select public.join_station('222222', 'Ngozi')$$);
select t.val(t.id('couns'), $$select public.join_station('333333', 'Femi', null, '303030', null, null, true)$$);
select t.val(t.id('med'), $$select public.join_station('444444', 'Amina', null, '404040', 'Dr', null, true)$$);
select t.val(t.id('lead'), $$select public.join_station('555555', 'Lead', null, '999999')$$);

select plan(22);

-- Registration (offline-style client ids, idempotent upsert)
select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.beneficiaries (id, org_id, full_name, phone, gender, age_range, community)
  values (t.id('ben'), app.session_org(), 'Test Person', '+2348099990000', 'female', '36-59', 'Kpegi');
  insert into public.visits (id, edition_id, beneficiary_id, card_code, registered_by_session, registered_at, consent_data_at, consent_followup_at, consent_version)
  values (t.id('visit'), app.session_edition(), t.id('ben'), 'TR26-0399', app.session_id(), now(), now(), now(), 1);
  insert into public.visit_needs (visit_id, station_id, edition_id) values (t.id('visit'), t.id('medical_station'), app.session_edition());
$q$)$$, 'registration session registers a person');
select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.visits (id, edition_id, beneficiary_id, card_code, registered_by_session, registered_at, consent_data_at, consent_version)
  values (t.id('visit'), app.session_edition(), t.id('ben'), 'TR26-0399', app.session_id(), now(), now(), 1)
  on conflict (id) do nothing
$q$)$$, 'retrying the same visit insert is a no-op (idempotent)');
select is((select status::text from public.cards where code = 'TR26-0399'), 'assigned', 'card becomes assigned');
select throws_ok($$select t.run(t.id('reg'), $q$
  insert into public.visits (id, edition_id, beneficiary_id, card_code, registered_by_session, registered_at, consent_data_at, consent_version)
  select gen_random_uuid(), app.session_edition(), id, 'TR26-0399', app.session_id(), now(), now(), 1
  from public.beneficiaries where id <> t.id('ben') and org_id = app.session_org() limit 1
$q$)$$, '23505', null, 'the same card cannot be assigned twice');
select is(t.val(t.id('reg'), $$select to_jsonb(count(*)) from public.find_duplicates(t.id('tr'), 'Test Persen', null) where beneficiary_id = t.id('ben')$$)::int,
  1, 'find_duplicates finds a misspelt name');

-- Prayer salvation -> follow-up
select lives_ok($$select t.run(t.id('prayer'), $q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, served_at)
  values (t.id('rec_prayer'), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Ngozi',
          'Health · Salvation', '{"focus":["Health"],"decision":"salvation","wants_followup":true,"join_fellowship":false}', now())
$q$)$$, 'prayer record saved');
select is((select count(*)::int from public.followups where visit_id = t.id('visit') and type = 'salvation'), 1, 'salvation creates a follow-up');
select is((select count(*)::int from public.followups where visit_id = t.id('visit') and type = 'prayer'), 1, 'wants follow-up creates a prayer follow-up');

-- Counselling urgent -> leads flag + referral to medical
select lives_ok($$select t.run(t.id('couns'), $q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, has_confidential, served_at)
  values (t.id('rec_couns'), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Femi', 'Counselling session',
          '{"category":"Grief","followup_needed":true,"risk":"urgent","refer_medical":true}', true, now());
  insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
  values (t.id('rec_couns'), app.session_edition(), t.id('visit'), 'counselling', '{"notes":"private"}');
$q$)$$, 'counselling record + confidential note saved');
select is((select count(*)::int from public.flags where visit_id = t.id('visit') and kind = 'urgent_counselling' and scope = 'leads'), 1, 'urgent counselling raises a leads flag');
select is((select count(*)::int from public.followups where visit_id = t.id('visit') and type = 'counselling_urgent'), 1, 'urgent counselling follow-up created');
select is((select count(*)::int from public.flags where visit_id = t.id('visit') and kind = 'referral'), 1, 'refer to medical raises a referral flag');
select is(t.val(t.id('lead'), $$select to_jsonb(count(*)) from public.flags where visit_id = t.id('visit') and scope = 'leads'$$)::int, 1, 'station lead sees the leads flag');

-- Medical dispense reduces stock; referral -> follow-up
select lives_ok($$select t.run(t.id('med'), $q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, has_confidential, served_at)
  values (t.id('rec_med'), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Amina', 'Medical check · referred',
          jsonb_build_object('tests', '["BP"]'::jsonb, 'referred', true, 'referral_urgency', 'routine',
            'items', jsonb_build_array(jsonb_build_object('item_id', t.id('paracetamol'), 'qty', 2))), true, now())
$q$)$$, 'medical record saved');
select is((select delta from public.inventory_movements where service_record_id = t.id('rec_med')), -2, 'dispense writes a -2 movement');
select is((select count(*)::int from public.followups where visit_id = t.id('visit') and type = 'medical_referral'), 1, 'medical referral follow-up created');
select is((select state::text from public.visit_needs where visit_id = t.id('visit') and station_id = t.id('medical_station')), 'served', 'medical need marked served');

-- Void within 10 minutes restores stock
select lives_ok($$select t.run(t.id('med'), $q$select public.void_service_record(t.id('rec_med'), 'undo')$q$)$$, 'own record voided (undo)');
select is((select coalesce(sum(delta), 0)::int from public.inventory_movements where service_record_id = t.id('rec_med')), 0, 'void returns stock');

-- Field-level LWW
select is(t.val(t.id('prayer'), $$select public.apply_patch('beneficiaries', t.id('ben'), '{"community":"Karu"}', now() - interval '1 hour')$$)->'rejected', '{}'::jsonb, 'first patch applied');
select is(t.val(t.id('prayer'), $$select public.apply_patch('beneficiaries', t.id('ben'), '{"community":"Nyanya"}', now() - interval '2 hours')$$)->'rejected'->>'community', 'Nyanya', 'older patch is rejected (LWW) and audited');

-- Closed edition blocks writes
update public.editions set status = 'closed' where id = t.id('tr');
select throws_ok($$select t.run(t.id('prayer'), $q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at)
  values (gen_random_uuid(), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Ngozi', 'x', now())
$q$)$$, 'P0001', 'edition_closed', 'closing the edition blocks new writes');

select * from finish();
rollback;
