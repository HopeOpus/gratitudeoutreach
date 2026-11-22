-- Pharmacy (migration 010): role PIN to join, reads Medical prescriptions only, dispenses from stock.
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

insert into t.ids values ('pharm', t.new_user()), ('pharm2', t.new_user()), ('med', t.new_user()), ('food', t.new_user()),
  ('tr', '00000000-0000-4000-8000-0000000000e1'), ('rx_rec', gen_random_uuid()), ('disp_rec', gen_random_uuid());
insert into t.ids select 'pharm_station', id from public.stations where kind = 'pharmacy' and edition_id = t.id('tr');
insert into t.ids select 'rx_visit', id from public.visits where edition_id = t.id('tr') order by card_code limit 1;
insert into t.ids select 'drug', id from public.inventory_items where name = 'Paracetamol 500mg' and edition_id = t.id('tr');

select plan(10);

select is((select name from public.stations where kind = 'prayer' and edition_id = t.id('tr')), 'Prayer & Counselling', 'Prayer and Counselling are one station');
select ok(not (select enabled from public.stations where kind = 'counselling' and edition_id = t.id('tr')), 'the private-notes Counselling station is off by default');

select is(t.val(t.id('pharm2'), $$select public.join_station('777777', 'No Pin')$$)->>'error', 'invalid_role_pin', 'Pharmacy needs the role PIN');
select ok(t.val(t.id('pharm'), $$select public.join_station('777777', 'Bayo', null, '707070', 'Pharm', null, true)$$) ? 'session', 'Pharmacy joins with the role PIN and agreement');
select t.val(t.id('med'), $$select public.join_station('444444', 'Amina', null, '404040', 'Dr', null, true)$$);
select t.val(t.id('food'), $$select public.join_station('555555', 'Kunle')$$);

-- Medical prescribes and refers to Pharmacy
select lives_ok($$select t.run(t.id('med'), format($q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, has_confidential, served_at)
  values (%L, app.session_edition(), %L, app.session_station(), app.session_id(), 'Amina', 'Medical check',
          jsonb_build_object('tests', '[]'::jsonb, 'referred', false, 'items', '[]'::jsonb, 'refer_to_station_ids', jsonb_build_array(%L)), true, now());
  insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
  values (%L, app.session_edition(), %L, 'medical', jsonb_build_object('prescription', jsonb_build_array(jsonb_build_object('item_id', %L, 'qty', 2, 'dosage', '1 tab twice daily'))));
$q$, t.id('rx_rec'), t.id('rx_visit'), t.id('pharm_station'), t.id('rx_rec'), t.id('rx_visit'), t.id('drug')))$$, 'Medical saves a prescription and refers to Pharmacy');
select is((select state::text from public.visit_needs where visit_id = t.id('rx_visit') and station_id = t.id('pharm_station')), 'referred', 'the person is now waiting at Pharmacy');

create function t.cnt(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin perform t.login(p_uid); execute 'select count(*) from (' || p_sql || ') x' into v; execute 'reset role'; return v; end $$;
grant execute on function t.cnt(uuid, text) to authenticated;
select is(t.cnt(t.id('pharm'), format($$select 1 from public.confidential_records where service_record_id = %L$$, t.id('rx_rec'))), 1::bigint, 'Pharmacy reads the prescription');
select is(t.cnt(t.id('pharm'), $$select 1 from public.confidential_records where kind = 'counselling'$$), 0::bigint, 'Pharmacy cannot read counselling notes');
select is(t.cnt(t.id('food'), $$select 1 from public.confidential_records where kind = 'medical'$$), 0::bigint, 'Food cannot read prescriptions');

-- Pharmacy dispenses: stock goes down
create temp table before as select remaining from public.inventory_items where id = t.id('drug');
select t.run(t.id('pharm'), format($q$
  insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, served_at)
  values (%L, app.session_edition(), %L, app.session_station(), app.session_id(), 'Bayo', 'Medicine given',
          jsonb_build_object('items', jsonb_build_array(jsonb_build_object('item_id', %L, 'qty', 2)), 'prescription_id', %L), now());
$q$, t.id('disp_rec'), t.id('rx_visit'), t.id('drug'), t.id('rx_rec')));
select is((select remaining from public.inventory_items where id = t.id('drug')), (select remaining - 2 from before), 'dispensing reduces stock');

select * from finish();
rollback;
