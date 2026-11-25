-- New enum values. Kept in their own migration: Postgres cannot use a new enum
-- value inside the transaction that adds it.
alter type public.station_kind add value if not exists 'medical_assistant';
alter type public.station_kind add value if not exists 'optician';
alter type public.station_kind add value if not exists 'laboratory';
-- Spiritual outcomes (faith, healing, Holy Ghost baptism): Counselling and coordinators only.
alter type public.confidential_kind add value if not exists 'spiritual';
