-- Shared helpers are created per test file (inside each transaction) because
-- `supabase test db` runs every file in its own session. See tests/01_rls.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select has_function('public', 'join_station', 'join_station RPC exists');
select * from finish();
rollback;
