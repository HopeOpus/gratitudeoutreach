-- PIN rate limiting: per device 5 failures, per shared venue IP 30 failures (5 min window).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
insert into public.join_attempts (user_id, ip, success)
select gen_random_uuid(), '10.0.0.1', false from generate_series(1, 10);
select ok(not app.join_locked(gen_random_uuid(), '10.0.0.1'), '10 typos from different phones on one venue IP do not lock the venue');
insert into public.join_attempts (user_id, ip, success)
select gen_random_uuid(), '10.0.0.1', false from generate_series(1, 20);
select ok(app.join_locked(gen_random_uuid(), '10.0.0.1'), '30 failures from one IP lock that IP');
insert into public.join_attempts (user_id, ip, success)
select '00000000-0000-4000-8000-00000000beef', null, false from generate_series(1, 5);
select ok(app.join_locked('00000000-0000-4000-8000-00000000beef', null), '5 failures lock that device');
select * from finish();
rollback;
