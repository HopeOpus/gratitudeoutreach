-- QR codes printed at registration: per-phone code blocks with background refill (migration 008).
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

insert into t.ids values ('reg', t.new_user()), ('prayer', t.new_user());
select t.val(t.id('reg'), $$select public.join_station('111111', 'Tobi')$$);
select t.val(t.id('prayer'), $$select public.join_station('222222', 'Ngozi')$$);

select plan(6);

create temp table b1 as select t.val(t.id('reg'), $$select public.reserve_code_block(999)$$) as v;
select is((select (v->>'range_end')::int from b1), 999, 'a registration phone gets a block of 999 codes');
select is(t.val(t.id('reg'), $$select public.reserve_code_block(999)$$)->>'id', (select v->>'id' from b1), 'asking again without p_new returns the same open block');

create temp table b2 as select t.val(t.id('reg'), $$select public.reserve_code_block(999, true)$$) as v;
select isnt((select v->>'id' from b2), (select v->>'id' from b1), 'p_new allocates a second block while the first still has codes');
select isnt((select v->>'prefix' from b2), (select v->>'prefix' from b1), 'each block has its own prefix, so codes never collide');
select throws_ok($$select t.val(t.id('prayer'), $q$select public.reserve_code_block(999, true)$q$)$$, '42501', null, 'only registration sessions can reserve codes');

select t.val(t.id('reg'), $$select public.reserve_code_block(10, true)$$) from generate_series(1, 18);
select throws_ok($$select t.val(t.id('reg'), $q$select public.reserve_code_block(10, true)$q$)$$, '54000', null, 'a session is capped at 20 blocks');

select * from finish();
rollback;
