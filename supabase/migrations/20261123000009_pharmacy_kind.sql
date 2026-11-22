-- New station kind. Kept in its own migration: Postgres cannot use a new enum
-- value inside the transaction that adds it.
alter type public.station_kind add value if not exists 'pharmacy';
