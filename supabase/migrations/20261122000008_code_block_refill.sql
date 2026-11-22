-- Registration desks now print a QR for every person, so each phone needs a
-- steady supply of codes. `p_new` allocates a fresh block even while the
-- current one has codes left (the phone tracks its own usage offline, so the
-- server cannot know how many are left). Capped at 20 blocks per session.

drop function if exists public.reserve_code_block(int);

create or replace function public.reserve_code_block(p_size int default 200, p_new boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_edition uuid := app.session_edition();
  v_prefix text;
  v_block int;
  v_row public.code_blocks;
begin
  if v_edition is null or app.session_kind() <> 'registration' then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if not coalesce(p_new, false) then
    select * into v_row from public.code_blocks where session_id = app.session_id() and next_value <= range_end limit 1;
    if found then return to_jsonb(v_row); end if;
  elsif (select count(*) from public.code_blocks where session_id = app.session_id()) >= 20 then
    raise exception 'too_many_blocks' using errcode = '54000';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_edition::text));
  select code_prefix into v_prefix from public.editions where id = v_edition;
  select coalesce(max(block_no), 0) + 1 into v_block from public.code_blocks where edition_id = v_edition;
  if v_block > 999 then
    raise exception 'no_blocks_left' using errcode = '54000';
  end if;
  insert into public.code_blocks (edition_id, session_id, block_no, prefix, range_start, range_end, next_value)
  values (v_edition, app.session_id(), v_block, v_prefix || '-R' || v_block, 1,
          least(greatest(coalesce(p_size, 200), 10), 999), 1)
  returning * into v_row;
  return to_jsonb(v_row);
end $$;
