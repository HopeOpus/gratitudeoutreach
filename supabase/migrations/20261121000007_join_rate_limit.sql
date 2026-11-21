-- Venue phones usually share ONE public IP (MiFi / church Wi-Fi NAT). Locking the IP
-- after 5 failures would let a few honest typos lock out every volunteer.
-- Per device (auth.uid): 5 failures / 5 min. Per IP: 30 failures / 5 min (still stops
-- brute force: 30 guesses per 5 min against a 1-in-a-million PIN space).
create or replace function app.join_locked(p_uid uuid, p_ip text) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.join_attempts a
      where a.success = false and a.at > now() - interval '5 minutes' and a.user_id = p_uid) >= 5
    or (p_ip is not null and (select count(*) from public.join_attempts a
      where a.success = false and a.at > now() - interval '5 minutes' and a.ip = p_ip) >= 30)
$$;
