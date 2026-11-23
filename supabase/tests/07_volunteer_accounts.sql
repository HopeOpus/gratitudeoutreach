-- Volunteer accounts (migration 011): register with PIN + name + phone, sign in
-- with name + phone on any number of devices.
begin;
create extension if not exists pgtap with schema extensions;

create schema t;
grant usage on schema t to authenticated;
create function t.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function t.val(p_uid uuid, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb; begin perform t.login(p_uid); execute p_sql into v; execute 'reset role'; return v; end $$;
create function t.cnt(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare v bigint; begin perform t.login(p_uid); execute 'select count(*) from (' || p_sql || ') x' into v; execute 'reset role'; return v; end $$;
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

insert into t.ids values ('phone_a', t.new_user()), ('phone_b', t.new_user()), ('phone_c', t.new_user()),
  ('med_a', t.new_user()), ('med_b', t.new_user()), ('dup', t.new_user()), ('coord', '00000000-0000-4000-8000-00000000ad02'), ('tr', '00000000-0000-4000-8000-0000000000e1');
insert into t.ids select 'food_station', id from public.stations where kind = 'food' and edition_id = t.id('tr');
insert into t.ids select 'clothing_station', id from public.stations where kind = 'clothing' and edition_id = t.id('tr');

select plan(18);

select has_table('public', 'volunteer_accounts', 'volunteer_accounts exists');
select ok((select relrowsecurity from pg_class where oid = 'public.volunteer_accounts'::regclass), 'RLS is on for volunteer_accounts');

-- Register
select is(t.val(t.id('phone_a'), $$select public.join_station('555555', 'Kunle')$$)->>'error', 'phone_required', 'registering needs a phone number');
select ok(t.val(t.id('phone_a'), $$select public.join_station('555555', 'Kunle', '+2348031110001')$$) ? 'session', 'registers at Food with PIN, name and phone');
select is((select count(*) from public.volunteer_accounts where phone = '+2348031110001'), 1::bigint, 'one account is created');
select is(t.val(t.id('dup'), $$select public.join_station('222222', 'Someone', '+2348031110001')$$)->>'error', 'already_registered', 'the same phone cannot register twice');

-- Sign in
select is(t.val(t.id('phone_b'), $$select public.sign_in_volunteer('Kunle', '+2348039999999')$$)->>'error', 'account_not_found', 'wrong phone: account not found');
select is(t.val(t.id('phone_b'), $$select public.sign_in_volunteer('Tunde', '+2348031110001')$$)->>'error', 'account_not_found', 'wrong name: account not found');
select is(t.val(t.id('phone_b'), $$select public.sign_in_volunteer('  kunle ', '+2348031110001')$$)->'session'->>'station_id',
  t.id('food_station')::text, 'a second device signs in (name ignores case and spaces) and lands on Food');
select is((select count(*) from public.volunteer_sessions s join public.volunteer_accounts a on a.id = s.account_id
           where a.phone = '+2348031110001' and s.revoked_at is null), 2::bigint, 'both devices stay signed in');
select is(t.val(t.id('phone_c'), $$select public.sign_in_volunteer('Kunle', '+2348031110001', '999999')$$)->'session'->>'role',
  'station_lead', 'the lead PIN still makes this device the Station Lead');

-- Confidential stations still need the role PIN on every device
select t.val(t.id('med_a'), $$select public.join_station('444444', 'Dr Amina', '+2348031110002', '404040', 'Dr', null, true)$$);
select is(t.val(t.id('med_b'), $$select public.sign_in_volunteer('Dr Amina', '+2348031110002')$$)->>'needs_role_pin', 'true', 'medical sign-in asks for the role PIN');
select is(t.val(t.id('med_b'), $$select public.sign_in_volunteer('Dr Amina', '+2348031110002', '000000', null, true)$$)->>'error', 'invalid_role_pin', 'a wrong role PIN is refused');
select ok(t.val(t.id('med_b'), $$select public.sign_in_volunteer('Dr Amina', '+2348031110002', '404040', null, true)$$) ? 'session', 'medical signs in with the role PIN and agreement');

-- Volunteers cannot read accounts directly
select is(t.cnt(t.id('phone_a'), $$select 1 from public.volunteer_accounts$$), 0::bigint, 'volunteers cannot read accounts');

-- Coordinator move follows the account onto every device
select lives_ok(format($$select t.val(t.id('coord'), $q$select null::jsonb from public.move_session(
    (select id from public.volunteer_sessions where user_id = %L and revoked_at is null), %L)$q$)$$,
  t.id('phone_a'), t.id('clothing_station')), 'coordinator moves the volunteer');
select is((select count(*) from public.volunteer_sessions s join public.volunteer_accounts a on a.id = s.account_id
           where a.phone = '+2348031110001' and s.revoked_at is null and s.station_id = t.id('clothing_station')), 3::bigint,
  'every signed-in device moves with the account');
select is(t.val(t.id('phone_b'), $$select public.sign_in_volunteer('Kunle', '+2348031110001')$$)->'session'->>'station_id',
  t.id('clothing_station')::text, 'after a move, signing in lands on the new station');

select * from finish();
rollback;
