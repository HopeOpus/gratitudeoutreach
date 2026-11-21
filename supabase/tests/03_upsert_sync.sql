-- The offline outbox pushes with INSERT ... ON CONFLICT DO NOTHING (idempotent).
-- These tests use exactly that statement shape for every table the client writes.
begin;
create extension if not exists pgtap with schema extensions;
create schema t;
grant usage on schema t to authenticated;
create function t.run(p_uid uuid, p_sql text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql;
  execute 'reset role';
end $$;
create function t.cnt(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
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
create table t.ids (k text primary key, v uuid);
create function t.id(p text) returns uuid language sql stable as $$ select v from t.ids where k = p $$;
grant select on t.ids to authenticated;
grant execute on all functions in schema t to authenticated;

insert into t.ids values ('reg', t.new_user()), ('food', t.new_user()), ('med', t.new_user()),
  ('ben', gen_random_uuid()), ('visit', gen_random_uuid()), ('rec', gen_random_uuid()), ('mrec', gen_random_uuid()), ('flag', gen_random_uuid());
select t.run(t.id('reg'), $$select public.join_station('111111', 'Tobi')$$);
select t.run(t.id('food'), $$select public.join_station('555555', 'Kunle')$$);
select t.run(t.id('med'), $$select public.join_station('444444', 'Amina', null, '404040', 'Dr', null, true)$$);

select plan(10);

select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.beneficiaries (id, org_id, full_name) values (t.id('ben'), app.session_org(), 'Sync Person') on conflict (id) do nothing$q$)$$,
  'registration: beneficiary upsert (ON CONFLICT DO NOTHING) passes RLS');
select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.beneficiaries (id, org_id, full_name) values (t.id('ben'), app.session_org(), 'Sync Person') on conflict (id) do nothing$q$)$$,
  'registration: retrying the same beneficiary is a no-op');
select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.visits (id, edition_id, beneficiary_id, registered_by_session, registered_at, consent_data_at, consent_version)
  values (t.id('visit'), app.session_edition(), t.id('ben'), app.session_id(), now(), now(), 1) on conflict (id) do nothing$q$)$$,
  'registration: visit upsert passes');
select lives_ok($$select t.run(t.id('reg'), $q$
  insert into public.visit_needs (visit_id, station_id, edition_id)
  select t.id('visit'), id, app.session_edition() from public.stations_public where edition_id = app.session_edition() and kind = 'food'
  on conflict (visit_id, station_id) do nothing$q$)$$, 'registration: needs upsert passes');
select is(t.cnt(t.id('food'), $$select 1 from public.beneficiaries where org_id = '00000000-0000-4000-8000-000000000001' and not exists (select 1 from public.visits v where v.beneficiary_id = beneficiaries.id)$$),
  0::bigint, 'food: cannot see visit-less beneficiaries (only registration can, while registering)');
select is(t.cnt(t.id('reg'), $$select 1 from public.beneficiaries b where not exists (select 1 from public.visits v where v.beneficiary_id = b.id) and b.id <> t.id('ben')$$),
  0::bigint, 'registration: after the visit exists, nothing visit-less is left visible');
select lives_ok($$select t.run(t.id('food'), $q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at, data)
  values (t.id('rec'), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Kunle', 'Single food pack ×1', now(), '{}')
  on conflict (id) do nothing;
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at, data)
  values (t.id('rec'), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Kunle', 'Single food pack ×1', now(), '{}')
  on conflict (id) do nothing$q$)$$, 'food: service record upsert is idempotent (retry does not trip the duplicate guard)');
select is((select count(*)::int from public.service_records where id = t.id('rec')), 1, 'exactly one record after retry');
select lives_ok($$select t.run(t.id('food'), $q$
  insert into public.flags (id, edition_id, visit_id, kind, scope, text, created_by_session)
  values (t.id('flag'), app.session_edition(), t.id('visit'), 'card_conflict', 'leads', 'Card conflict', app.session_id()) on conflict (id) do nothing$q$)$$,
  'volunteer can upsert a leads-only flag it raises');
select lives_ok($$select t.run(t.id('med'), $q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, served_at, data, has_confidential)
  values (t.id('mrec'), app.session_edition(), t.id('visit'), app.session_station(), app.session_id(), 'Amina', 'Medical check', now(), '{}', true) on conflict (id) do nothing;
  insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
  values (t.id('mrec'), app.session_edition(), t.id('visit'), 'medical', '{"vitals":{}}') on conflict (service_record_id) do nothing$q$)$$,
  'medical: record + confidential upsert passes');

select * from finish();
rollback;
