-- Gratitude Connect — seed / training data (docs/DataModel.md §6)
-- Training PINs and admin logins are documented in README.md.
set session_replication_role = default;

do $seed$
declare
  v_org uuid := '00000000-0000-4000-8000-000000000001';
  v_tr uuid := '00000000-0000-4000-8000-0000000000e1';    -- Training 2026 (live, is_training)
  v_go uuid := '00000000-0000-4000-8000-0000000000e2';    -- Gratitude Outreach 2026 (draft)
  v_pw text := extensions.crypt('Gratitude2026!', extensions.gen_salt('bf', 8));
  v_seed_user uuid := '00000000-0000-4000-8000-00000000a0a0';
  u record;
  st record;
  v_station jsonb := '{}';
  v_session jsonb := '{}';
  v_items_food uuid[];
  v_items_cloth uuid[];
  v_items_med uuid[];
  i int;
  v_b uuid; v_v uuid; v_r uuid;
  v_first text; v_last text; v_name text;
  v_gender public.gender; v_age public.age_range; v_comm text; v_phone text;
  v_reg timestamptz; v_at timestamptz;
  v_need text;
  v_day_start timestamptz := (current_date::timestamp + time '08:00') at time zone 'Africa/Lagos';
  firsts_f text[] := array['Ada','Ngozi','Chiamaka','Aisha','Fatima','Blessing','Grace','Funke','Bisi','Amina','Zainab','Halima','Chioma','Esther','Ruth','Mercy','Joy','Patience','Hauwa','Ifeoma','Kemi','Yetunde','Titi','Nkechi','Uche','Hadiza','Rakiya','Comfort','Precious','Favour'];
  firsts_m text[] := array['Musa','John','Emeka','Tunde','Ibrahim','Chinedu','Segun','Yusuf','Samuel','Daniel','Obinna','Abdullahi','Femi','Kunle','Sani','Bello','Uchenna','Peter','Paul','David','Ahmed','Garba','Ikenna','Tobi','Victor','Godwin','Sunday','Emmanuel','Isaac','Joseph'];
  lasts text[] := array['Okafor','Bello','Adeyemi','Okonkwo','Abubakar','Eze','Ibrahim','Ogunleye','Nwosu','Musa','Danjuma','Okoro','Adebayo','Usman','Obi','Balogun','Yakubu','Chukwu','Afolabi','Garba','Onyeka','Suleiman','Ojo','Lawal','Akpan','Etim','Bassey','Audu','Ogbu','Ayodele'];
  comms text[] := array['Kpegi','Jikwoyi','Karu','Nyanya','Kugbo','Orozo','Karshi','Mararaba','Kurudu','Gwagwa'];
  langs text[] := array['English','Pidgin','Hausa','Igbo','Yoruba'];
  focus_opts text[] := array['Health','Family','Finances','Job','Spiritual growth','Deliverance'];
  couns_cats text[] := array['Marriage/Family','Grief','Addiction','Mental wellbeing','Career/Finance','Spiritual','Youth'];
  complaints text[] := array['Fever','Headache','Body pain','Cough','Eye','Hypertension follow-up','Diabetes follow-up','Skin'];
  v_focus text[]; v_decision text; v_item uuid; v_qty int; v_sys int; v_dia int; v_ref boolean;
begin
  perform setseed(0.42);

  -- Organisation ---------------------------------------------------------------
  insert into public.organizations (id, name, church_name, consent_text, consent_version, retention_months)
  values (v_org, 'Gratitude Outreach', 'Gratitude Church',
    'We would like to write down your name, phone number (if you want), age range and community, and the services you receive today. '
    || 'We use this only to serve you well today, to avoid asking you the same questions at every station, and to plan future outreaches. '
    || 'Only our trained volunteers can see your details. Medical and counselling notes are seen only by the doctors, nurses and counsellors. '
    || 'We keep private notes for 24 months and then remove them. You can ask us at any time to see or delete your information. '
    || 'Is it okay for us to record your details? And may our follow-up team call or message you after today?',
    1, 24)
  on conflict (id) do nothing;

  -- Admin users (email + password) --------------------------------------------
  for u in select * from (values
      ('00000000-0000-4000-8000-00000000ad01'::uuid, 'admin@gratitude.test', 'super_admin'::public.org_role, 'Pastor Admin'),
      ('00000000-0000-4000-8000-00000000ad02'::uuid, 'coordinator@gratitude.test', 'coordinator'::public.org_role, 'Bro. Coordinator'),
      ('00000000-0000-4000-8000-00000000ad03'::uuid, 'followup@gratitude.test', 'followup'::public.org_role, 'Sis. Follow-up'),
      ('00000000-0000-4000-8000-00000000ad04'::uuid, 'viewer@gratitude.test', 'viewer'::public.org_role, 'Senior Pastor')
    ) as t(id, email, role, display_name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.display_name), now(), now(),
      '', '', '', '', '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now())
    on conflict do nothing;
    insert into public.org_members (org_id, user_id, role, display_name) values (v_org, u.id, u.role, u.display_name)
    on conflict do nothing;
  end loop;

  -- Seed volunteer (owns historical training sessions) ------------------------
  insert into auth.users (instance_id, id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_seed_user, 'authenticated', 'authenticated', true, '{}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  -- Editions -------------------------------------------------------------------
  insert into public.editions (id, org_id, name, code_prefix, starts_on, ends_on, venue, status, is_training)
  values (v_tr, v_org, 'Training 2026', 'TR26', current_date, current_date, 'Training hall', 'live', true),
         (v_go, v_org, 'Gratitude Outreach 2026', 'GO26', date '2026-12-12', date '2026-12-12', 'Kpegi Community Primary School', 'draft', false)
  on conflict (id) do nothing;

  -- Training stations with documented PINs (lead PIN 999999 everywhere)
  for st in select * from (values
      ('registration', 'Registration', 'ClipboardPen', 0, '111111', null),
      ('prayer', 'Prayer', 'HandHeart', 1, '222222', null),
      ('counselling', 'Counselling', 'MessagesSquare', 2, '333333', '303030'),
      ('medical', 'Medical', 'Stethoscope', 3, '444444', '404040'),
      ('food', 'Food', 'UtensilsCrossed', 4, '555555', null),
      ('clothing', 'Clothing', 'Shirt', 5, '666666', null)
    ) as t(kind, name, icon, ord, pin, role_pin)
  loop
    insert into public.stations (id, edition_id, kind, name, icon, sort_order, is_service, join_pin_hash, role_pin_hash, lead_pin_hash)
    values (gen_random_uuid(), v_tr, st.kind::public.station_kind, st.name, st.icon, st.ord, st.kind <> 'registration',
      app.hash_pin(st.pin), case when st.role_pin is not null then app.hash_pin(st.role_pin) end, app.hash_pin('999999'))
    returning jsonb_build_object(st.kind, id) || v_station into v_station;
    insert into public.station_secrets (station_id, join_pin_enc, role_pin_enc, lead_pin_enc)
    values ((v_station->>st.kind)::uuid, 'training:' || st.pin,
            case when st.role_pin is not null then 'training:' || st.role_pin end, 'training:999999');

    insert into public.volunteer_sessions (id, user_id, edition_id, station_id, role, display_name, expires_at, revoked_at, last_seen_at)
    values (gen_random_uuid(), v_seed_user, v_tr, (v_station->>st.kind)::uuid, 'volunteer',
      case st.kind when 'registration' then 'Tobi' when 'prayer' then 'Sis. Ngozi' when 'counselling' then 'Bro. Femi'
                   when 'medical' then 'Dr. Amina' when 'food' then 'Kunle' else 'Grace' end,
      now() + interval '12 hours', now(), now() - interval '1 hour')
    returning jsonb_build_object(st.kind, id) || v_session into v_session;
  end loop;

  -- Draft real edition: default stations with random PINs (rotate in admin to reveal)
  insert into public.stations (edition_id, kind, name, icon, sort_order, is_service, join_pin_hash)
  select v_go, k::public.station_kind, n, ic, o, k <> 'registration', app.hash_pin(app.random_pin())
  from (values ('registration','Registration','ClipboardPen',0), ('prayer','Prayer','HandHeart',1),
               ('counselling','Counselling','MessagesSquare',2), ('medical','Medical','Stethoscope',3),
               ('food','Food','UtensilsCrossed',4), ('clothing','Clothing','Shirt',5)) as d(k, n, ic, o);

  -- Inventory: 60 items -----------------------------------------------------------
  insert into public.inventory_items (edition_id, station_id, name, unit, opening_qty, low_threshold)
  select v_tr, (v_station->>'food')::uuid, n, un, q, 20 from (values
    ('Family food pack','pack',400),('Single food pack','pack',250),('Hot meal','plate',500),('Rice 5kg','bag',80),
    ('Beans 2kg','bag',80),('Garri 2kg','bag',90),('Noodles carton','carton',60),('Cooking oil 1L','bottle',100),
    ('Tomato paste tin','tin',150),('Sugar 500g','pack',120),('Bread loaf','loaf',200),('Water sachet bag','bag',300)
  ) as t(n, un, q);

  insert into public.inventory_items (edition_id, station_id, name, unit, sizes, opening_qty, low_threshold)
  select v_tr, (v_station->>'clothing')::uuid, n, 'pcs', sz, q, 10 from (values
    ('Men shirt', array['S','M','L','XL'], 80), ('Men trousers', array['30','32','34','36'], 60),
    ('Men native wear', array['M','L','XL'], 30), ('Men T-shirt', array['M','L','XL'], 70),
    ('Women blouse', array['S','M','L','XL'], 80), ('Women skirt', array['S','M','L'], 60),
    ('Women wrapper', null, 70), ('Women gown', array['S','M','L','XL'], 50),
    ('Children shirt', array['2-4','5-7','8-10','11-13'], 90), ('Children shorts', array['2-4','5-7','8-10','11-13'], 80),
    ('Children gown', array['2-4','5-7','8-10','11-13'], 70), ('Baby clothes set', array['0-6m','6-12m','1-2y'], 40),
    ('School uniform', array['5-7','8-10','11-13'], 40), ('Men shoes', array['41','42','43','44','45'], 40),
    ('Women shoes', array['37','38','39','40','41'], 40), ('Children shoes', array['28','30','32','34'], 50),
    ('Slippers', array['S','M','L'], 100), ('Bedsheet', null, 40), ('Blanket', null, 30), ('Mosquito net', null, 60),
    ('Towel', null, 50), ('Socks (pair)', null, 80), ('Cap', null, 40), ('Sweater', array['S','M','L','XL'], 30)
  ) as t(n, sz, q);

  insert into public.inventory_items (edition_id, station_id, name, unit, opening_qty, low_threshold)
  select v_tr, (v_station->>'medical')::uuid, n, un, q, 15 from (values
    ('Paracetamol 500mg','strip',300),('Ibuprofen 400mg','strip',150),('Artemether-lumefantrine (ACT)','pack',120),
    ('Amoxicillin 500mg','strip',100),('ORS sachet','sachet',150),('Vitamin C 100mg','strip',200),('Multivitamin','strip',200),
    ('Antacid tablets','strip',100),('Amlodipine 5mg','strip',60),('Metformin 500mg','strip',60),('Lisinopril 10mg','strip',40),
    ('Eye drops','bottle',50),('Hydrocortisone cream','tube',40),('Albendazole 400mg','tab',150),('Ferrous sulphate','strip',100),
    ('Folic acid','strip',100),('Cough syrup','bottle',60),('Loratadine 10mg','strip',60),('Chlorhexidine wash','bottle',30),
    ('Gauze pack','pack',50),('Plaster roll','roll',40),('Glucose test strip','strip',200),('Malaria RDT','kit',200),('Zinc tablets','strip',80)
  ) as t(n, un, q);

  select array_agg(id order by name) into v_items_food from public.inventory_items where station_id = (v_station->>'food')::uuid and name like '%pack' or (station_id = (v_station->>'food')::uuid and name = 'Hot meal');
  select array_agg(id order by name) into v_items_cloth from public.inventory_items where station_id = (v_station->>'clothing')::uuid;
  select array_agg(id order by name) into v_items_med from public.inventory_items where station_id = (v_station->>'medical')::uuid;

  -- Cards ----------------------------------------------------------------------------
  insert into public.cards (edition_id, code, batch_no)
  select v_tr, 'TR26-' || lpad(n::text, 4, '0'), 1 from generate_series(1, 400) n;

  -- 300 beneficiaries with visits, needs and services ---------------------------------
  for i in 1..300 loop
    v_gender := case when random() < 0.56 then 'female' else 'male' end;
    v_first := case when v_gender = 'female' then firsts_f[1 + floor(random() * 30)::int] else firsts_m[1 + floor(random() * 30)::int] end;
    v_last := lasts[1 + floor(random() * 30)::int];
    v_name := v_first || ' ' || v_last;
    v_age := (array['0-12','13-17','18-35','18-35','36-59','36-59','36-59','60+'])[1 + floor(random() * 8)::int]::public.age_range;
    v_comm := comms[1 + floor(random() * 10)::int];
    v_phone := case when random() < 0.65 and v_age not in ('0-12') then '+2348' || (array['0','1','0','1'])[1 + floor(random() * 4)::int] || lpad(floor(random() * 100000000)::text, 8, '0') end;
    v_reg := v_day_start + make_interval(mins => floor(random() * 300)::int);
    v_b := gen_random_uuid();
    v_v := gen_random_uuid();

    insert into public.beneficiaries (id, org_id, full_name, phone, gender, age_range, community, language, church_member, guardian_name)
    values (v_b, v_org, v_name, v_phone, v_gender, v_age, v_comm, langs[1 + floor(random() * 5)::int],
      (array['yes','no','visitor'])[1 + floor(random() * 3)::int],
      case when v_age in ('0-12','13-17') then firsts_f[1 + floor(random() * 30)::int] || ' ' || v_last end);

    insert into public.visits (id, edition_id, beneficiary_id, card_code, household_size, registered_by_session, registered_by_name,
      registered_at, consent_data_at, consent_followup_at, consent_version)
    values (v_v, v_tr, v_b, 'TR26-' || lpad(i::text, 4, '0'), 1 + floor(random() * 6)::int, (v_session->>'registration')::uuid, 'Tobi',
      v_reg, v_reg, case when random() < 0.7 then v_reg end, 1);

    foreach v_need in array array['prayer','counselling','medical','food','clothing'] loop
      if random() < (case v_need when 'food' then 0.75 when 'clothing' then 0.5 when 'medical' then 0.55 when 'prayer' then 0.6 else 0.2 end) then
        insert into public.visit_needs (visit_id, station_id, edition_id, state, source, state_at)
        values (v_v, (v_station->>v_need)::uuid, v_tr, 'pending', 'registration', v_reg) on conflict do nothing;

        if random() < 0.62 then
          v_at := v_reg + make_interval(mins => 5 + floor(random() * 120)::int);
          v_r := gen_random_uuid();
          if v_need = 'prayer' then
            v_focus := array(select f from unnest(focus_opts) f where random() < 0.3);
            if cardinality(v_focus) = 0 then v_focus := array['Health']; end if;
            v_decision := case when random() < 0.12 then 'salvation' when random() < 0.08 then 'rededication' else 'none' end;
            insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, served_at)
            values (v_r, v_tr, v_v, (v_station->>'prayer')::uuid, (v_session->>'prayer')::uuid, 'Sis. Ngozi',
              array_to_string(v_focus, ', ') || case v_decision when 'salvation' then ' · Salvation' when 'rededication' then ' · Rededication' else '' end,
              jsonb_build_object('focus', to_jsonb(v_focus), 'decision', v_decision, 'wants_followup', random() < 0.25,
                                 'join_fellowship', random() < 0.15), v_at);
          elsif v_need = 'counselling' then
            insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, has_confidential, served_at)
            values (v_r, v_tr, v_v, (v_station->>'counselling')::uuid, (v_session->>'counselling')::uuid, 'Bro. Femi', 'Counselling session',
              jsonb_build_object('category', couns_cats[1 + floor(random() * 7)::int], 'followup_needed', random() < 0.4,
                'risk', case when random() < 0.05 then 'urgent' when random() < 0.2 then 'pastoral' else 'none' end,
                'refer_medical', random() < 0.1), true, v_at);
            insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
            values (v_r, v_tr, v_v, 'counselling', jsonb_build_object('notes', 'Training note: spoke about family pressures and coping. (fake data)'));
          elsif v_need = 'medical' then
            v_sys := 105 + floor(random() * 70)::int;
            v_dia := 65 + floor(random() * 40)::int;
            v_ref := random() < 0.08;
            v_item := v_items_med[1 + floor(random() * cardinality(v_items_med))::int];
            insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, has_confidential, served_at)
            values (v_r, v_tr, v_v, (v_station->>'medical')::uuid, (v_session->>'medical')::uuid, 'Dr. Amina',
              case when v_ref then 'Medical check · referred' else 'Medical check' end,
              jsonb_build_object('tests', jsonb_build_array('BP'), 'referred', v_ref,
                'referral_urgency', case when v_ref then 'routine' end,
                'items', jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', 1))), true, v_at);
            insert into public.confidential_records (service_record_id, edition_id, visit_id, kind, payload)
            values (v_r, v_tr, v_v, 'medical', jsonb_build_object(
              'vitals', jsonb_build_object('bp_sys', v_sys, 'bp_dia', v_dia, 'pulse', 60 + floor(random() * 40)::int,
                                           'temp_c', round((36 + random() * 2.5)::numeric, 1)),
              'complaint', jsonb_build_array(complaints[1 + floor(random() * 8)::int]),
              'impression', 'Training impression (fake data)', 'designation', 'Dr',
              'dispensed', jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', 1, 'dosage', '1 tab twice daily'))));
          elsif v_need = 'food' then
            v_item := v_items_food[1 + floor(random() * cardinality(v_items_food))::int];
            insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, served_at)
            values (v_r, v_tr, v_v, (v_station->>'food')::uuid, (v_session->>'food')::uuid, 'Kunle',
              (select name from public.inventory_items where id = v_item) || ' ×1',
              jsonb_build_object('items', jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', 1))), v_at);
          else
            v_qty := 1 + floor(random() * 3)::int;
            v_item := v_items_cloth[1 + floor(random() * cardinality(v_items_cloth))::int];
            insert into public.service_records (id, edition_id, visit_id, station_id, session_id, served_by_name, summary, data, served_at)
            values (v_r, v_tr, v_v, (v_station->>'clothing')::uuid, (v_session->>'clothing')::uuid, 'Grace',
              v_qty || case when v_qty = 1 then ' item' else ' items' end,
              jsonb_build_object('for', 'self', 'items', jsonb_build_array(jsonb_build_object('item_id', v_item, 'qty', v_qty))), v_at);
          end if;
        end if;
      end if;
    end loop;
  end loop;
end
$seed$;
