# Gratitude Connect — Product Requirements Document (PRD)

**Product:** Gratitude Connect (working name, can be renamed)
**Owner organisation:** Gratitude Outreach (church community outreach arm)
**Built by:** Geetek Global Limited
**Document version:** 1.0 · November 2026
**Status:** Ready for build

---

## 1. Summary

Every year, Gratitude Outreach serves its community in one day: food, clothing, free medical checks, counselling and prayer. Today, each person who arrives gets a paper code. Their name is written down again at every station they visit. When the day ends, the data sits on many sheets of paper in many hands. Someone then has to collate it by hand, and that takes weeks.

**Gratitude Connect** is a mobile-first web app (installable as a PWA) that gives every beneficiary **one digital record and one code (QR + short code)**. Volunteers at each station scan the card or search a name, see what earlier stations recorded, add their own service in a few taps, and move on. The data is in one place, live, while the event runs. When the event closes, the reports are already done.

**Key promise:** *Register once. Every station sees what happened before. No paper collation afterwards.*

---

## 2. Problem statement

| # | Problem today | Effect |
|---|---|---|
| P1 | Names are captured again at every station | Slow queues, misspellings, duplicate records |
| P2 | Paper is scattered across volunteers | Data is lost or never handed in |
| P3 | Stations can't see what other stations did | A counsellor doesn't know the person already had prayer; medical doesn't know about food |
| P4 | Collating data after the event is manual | Days or weeks of work, error-prone totals |
| P5 | No live view during the event | Coordinators can't see queues, stock levels or crowd size |
| P6 | Follow-up (salvation decisions, referrals, counselling callbacks) depends on paper | People who needed follow-up are missed |
| P7 | No year-on-year history | The church can't show impact or spot returning beneficiaries |

---

## 3. Goals and non-goals

### Goals
1. **G1:** Register a beneficiary in **under 60 seconds**.
2. **G2:** Retrieve a beneficiary at any station in **under 5 seconds** (QR scan) or under 10 seconds (name/phone search).
3. **G3:** Every station sees the person's **service timeline**, updated in real time by earlier stations, with confidential details hidden by role.
4. **G4:** **Zero manual collation:** all totals, lists and exports are ready the moment the event closes.
5. **G5:** Work reliably on **low-end Android phones with weak or no internet** (offline-first, syncs when back online).
6. **G6:** A **live coordinator dashboard** showing people served, pending needs per station, stock levels and volunteer activity.
7. **G7:** A **follow-up pipeline** so no salvation decision, prayer request, counselling callback or medical referral is lost.
8. **G8:** Keep data across **multiple editions** (years) and recognise returning beneficiaries.

### Non-goals (v1)
- Not a full church membership system (CRM).
- Not an electronic medical records (EMR) system. Medical capture is light: vitals, complaint, what was given, referral.
- No payments or donations in v1.
- No native iOS/Android apps in v1; the PWA covers this.
- No self-service beneficiary app. Beneficiaries never log in.

---

## 4. Users and roles

| Role | Who | What they do | Device |
|---|---|---|---|
| **Super Admin** | Outreach director / church admin | Creates editions, stations and admins; sees everything except confidential notes, which only role-holders see | Laptop |
| **Event Coordinator** | Day-of lead | Live dashboard, volunteer management, inventory, reports, exports | Laptop / tablet |
| **Station Lead** | Head of a station (e.g. Medical lead) | Manages their station's volunteers and stock; sees their station's full data | Phone / tablet |
| **Registration Volunteer** | Front-desk team | Registers beneficiaries, links QR cards, captures needs and consent | Phone / tablet |
| **Station Volunteer** | Prayer, Food, Clothing, etc. | Scans or searches, sees the timeline, records the service | Phone |
| **Counsellor** | Trained counsellors | Same as Station Volunteer, plus confidential counselling notes | Phone |
| **Medical Staff** | Doctors, nurses, pharmacists | Same as Station Volunteer, plus confidential medical notes, vitals and dispensing | Phone / tablet |
| **Follow-up Team** | Pastoral care / ministry team | Works the follow-up list after the event (calls, visits, outcomes) | Phone / laptop |
| **Viewer** | Senior Pastor, board | Read-only dashboard and reports (aggregates only) | Any |

**Beneficiary:** the community member being served. Never logs in. Holds a physical **Gratitude Card** (QR + short code).

---

## 5. Core concepts

- **Edition:** one outreach event (e.g. *Gratitude Outreach 2026*). Has a date, venue, stations, volunteers and inventory.
- **Station:** a service point (Registration, Prayer, Counselling, Medical, Food, Clothing, plus custom ones such as Children's Corner, Eye Check or Haircut).
- **Beneficiary:** a person served. Lives across editions (returning visitors can be matched by phone number).
- **Visit:** a beneficiary's attendance at one edition (one per beneficiary per edition).
- **Gratitude Card:** a pre-printed card with a QR code and a short human-readable code, e.g. `GO26-0142`. Cards are printed **before** the event and linked to a person at registration, so no printer is needed on site.
- **Need:** a service the person asked for at registration (e.g. Food, Medical). Needs drive each station's **pending list**.
- **Service Record:** what one station did for one person (who served, when, what was given, structured fields, optional notes).
- **Confidential Note:** counselling or medical detail visible only to authorised roles.
- **Follow-up:** a task created from a service (salvation decision, prayer request, counselling callback, medical referral).

---

## 6. Event-day journey (happy path)

1. **Arrival → Registration desk.** Volunteer picks up a blank Gratitude Card, scans it, enters name, phone (optional), gender, age range and community. They tick the needs (Food, Clothing, Medical, Counselling, Prayer), capture consent and save. The person keeps the card.
2. **Station visit (e.g. Medical).** The person shows their card. The volunteer taps **Scan** and the profile opens. It shows the needs, the stations already visited (e.g. *Prayer ✓ 10:12 by Sis. Ada*) and any alerts (e.g. *Referred from Counselling*). The volunteer records the service and saves. The timeline updates for every other station instantly.
3. **No card / lost card.** Search by name or phone, confirm identity using age range and community, then optionally link a replacement card.
4. **Exit (optional).** A checkout point marks the visit complete and catches unmet needs ("You asked for clothing but didn't collect").
5. **During the event**, coordinators watch the live dashboard: people registered, served per station, pending queues, stock levels and volunteer activity.
6. **After the event**, reports and exports are ready immediately. The follow-up team works its list.

---

## 7. Functional requirements

Priority: **P0** = MVP must-have · **P1** = v1 should-have · **P2** = later

### 7.1 Edition and station setup (Admin)
| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | Create, edit and archive an **Edition** (name, date(s), venue, theme, status: Draft → Live → Closed). | P0 |
| FR-1.2 | Default stations auto-created: Registration, Prayer, Counselling, Medical, Food, Clothing. Each can be enabled or disabled, renamed, and given an icon and colour. | P0 |
| FR-1.3 | Add **custom stations** with a simple form builder (field types: text, number, single select, multi select, yes/no, quantity). | P1 |
| FR-1.4 | Each station has a **join PIN** (6 digits) and a **join QR** that volunteers use to sign in to that station. PINs can be rotated. | P0 |
| FR-1.5 | Clone an edition's setup (stations, forms, inventory items) from a previous year. | P1 |
| FR-1.6 | Edition **Close** locks new edits (Super Admin can reopen) and triggers the final report. | P0 |

### 7.2 Gratitude Cards (pre-printing)
| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Generate a batch of card codes for an edition (e.g. 1,500), format `GO{YY}-{NNNN}`, with QR payloads. | P0 |
| FR-2.2 | Export a **print-ready PDF**: A4 sheets of cards (8 or 10 per page) with the logo, QR, short code, edition name and a "Keep this card" note. Also an option for 58 mm thermal sticker labels. | P0 |
| FR-2.3 | The QR payload contains **only the card code** (e.g. `GC:GO26-0142`), never personal data. | P0 |
| FR-2.4 | Card status: Unassigned → Assigned → Void. A lost card can be voided and replaced; the history is kept. | P0 |
| FR-2.5 | Fallback: generate a code on the spot (device-reserved code block) if cards run out. Show the code large on screen to write on a wristband or paper. | P1 |

### 7.3 Registration
| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Scan a blank card (camera) or type its code to start a registration. | P0 |
| FR-3.2 | Fields: **Full name** (required), **Phone** (optional, Nigerian format validated, `+234`), **Gender**, **Age range** (Child 0–12, Teen 13–17, Young adult 18–35, Adult 36–59, Senior 60+), **Community / area** (searchable list plus free text), **Household size** (optional), **Church member?** (Yes/No/Visitor), **Language preference** (English, Pidgin, Hausa, Igbo, Yoruba, Other). | P0 |
| FR-3.3 | **Needs** multi-select, built from the enabled service stations. | P0 |
| FR-3.4 | **Consent** checkbox with a short script shown to the volunteer, read aloud (NDPA 2023 compliant): what's collected, why, who sees it, how long it's kept. Consent for follow-up contact is captured separately. | P0 |
| FR-3.5 | **Minors:** if the age range is Child or Teen, require a guardian name and link to the guardian's record if present. | P0 |
| FR-3.6 | **Duplicate check:** on phone or name entry, show possible matches (this edition and previous editions). Choose "Same person" (creates a new Visit on the existing Beneficiary) or "New person". | P0 |
| FR-3.7 | **Returning beneficiary:** if matched to a previous edition, show "Returning — last visited 2025". | P1 |
| FR-3.8 | **Family/group registration:** register a household quickly (head of household plus dependants), each with their own card. | P1 |
| FR-3.9 | Optional photo capture (off by default; only with consent). | P2 |

### 7.4 Lookup (all stations)
| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Big **Scan card** button opens the camera and decodes the QR in under 1 s on mid-range devices. | P0 |
| FR-4.2 | **Search** by short code, name (fuzzy, tolerant of typos) or phone (last 4 digits OK). Results show name, age range, community and card code. | P0 |
| FR-4.3 | Manual code entry with a numeric keypad (`GO26-` prefilled). | P0 |
| FR-4.4 | Recent people at this station (last 20) for quick re-access. | P1 |

### 7.5 Beneficiary profile and timeline (all stations)
| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Header: name, card code, age range, gender, community, language, returning badge. | P0 |
| FR-5.2 | **Needs checklist:** each need shows Pending / Served (time) / Declined. | P0 |
| FR-5.3 | **Timeline:** chronological service records from every station (station, time, volunteer first name, summary). Confidential content shows only as *"Counselling session recorded 🔒"* to unauthorised roles. | P0 |
| FR-5.4 | **Alerts / flags:** e.g. *Referred to Medical by Counselling*, *Allergy noted* (visible to Medical only), *Already collected food today*. | P0 |
| FR-5.5 | **Real-time updates:** if another station records a service while the profile is open, the timeline updates live, with a subtle highlight. | P0 |
| FR-5.6 | Edit basic details (name spelling, phone) with an audit log entry. | P0 |

### 7.6 Station service recording
Each station has a purpose-built, minimal-tap form. All forms include optional **Notes** and **Refer to station** (creates a pending need at another station).

| ID | Station | Fields | Priority |
|---|---|---|---|
| FR-6.1 | **Prayer** | Prayer focus (multi: Health, Family, Finances, Job, Spiritual growth, Deliverance, Other); **Decision** (None / Salvation / Rededication); Wants follow-up (Y/N); Wants to join a fellowship (Y/N); Prayed by (auto); Notes. A Salvation or Rededication decision **auto-creates a Follow-up**. | P0 |
| FR-6.2 | **Counselling** 🔒 | Category (Marriage/Family, Grief, Addiction, Mental wellbeing, Career/Finance, Spiritual, Youth, Other); Session notes (confidential); Risk flag (None / Needs pastoral attention / **Urgent: refer to professional**); Follow-up needed (Y/N, preferred time); Refer to Medical. | P0 |
| FR-6.3 | **Medical** 🔒 | Vitals: BP (sys/dia), pulse, temperature, weight, blood sugar (RBS), height optional; Presenting complaint (quick-pick plus text); Clinical impression (text); **Medication dispensed** (from medical inventory, with quantity, which decrements stock); Tests done (Malaria RDT, BP, Sugar, Eye check, etc.); **Referral** to hospital (Y/N, facility, reason, urgency); Attended by (auto, with designation Dr/Nurse/Pharm). Abnormal vitals auto-highlighted (e.g. BP ≥ 140/90, RBS ≥ 200 mg/dL). | P0 |
| FR-6.4 | **Food** | Pack type (from inventory, e.g. Family pack, Single pack, Hot meal); Quantity; Household size served; **Duplicate guard**: warn if already collected this edition (override needs Station Lead PIN). | P0 |
| FR-6.5 | **Clothing** | Items (category from inventory: Men, Women, Children, Shoes, Bedding) with size and quantity; For (Self / Child / Other household member). Decrements stock. | P0 |
| FR-6.6 | **Custom station** | Uses the fields defined in FR-1.3. | P1 |
| FR-6.7 | **Mark need as Declined / Not available** (e.g. clothing ran out), with a reason. | P0 |
| FR-6.8 | Save shows a success state and returns to **Scan** in one tap (the station "loop"). | P0 |
| FR-6.9 | Undo or edit own record within 10 minutes; later edits need Station Lead approval and are audit-logged. | P1 |

### 7.7 Station queue / pending list
| ID | Requirement | Priority |
|---|---|---|
| FR-7.1 | Each station sees a **Pending** list: people registered with this need, or referred here, and not yet served. Sorted by registration time. | P0 |
| FR-7.2 | Counter chips: Pending · Served today · Avg service time. | P0 |
| FR-7.3 | **Call next:** optionally show the next 5 names on a TV/projector display for the station (public screen shows first name + card code only). | P2 |

### 7.8 Inventory
| ID | Requirement | Priority |
|---|---|---|
| FR-8.1 | Inventory items per station (food packs, clothing categories, medications) with opening quantity and unit. | P0 |
| FR-8.2 | Stock decrements automatically as services are recorded; manual adjustments (restock / damage) are logged. | P0 |
| FR-8.3 | Low-stock threshold alerts to the Station Lead and Coordinator. | P1 |
| FR-8.4 | Out of stock: the item can't be selected, and the need is auto-suggested as "Declined — out of stock". | P1 |

### 7.9 Live coordinator dashboard
| ID | Requirement | Priority |
|---|---|---|
| FR-9.1 | KPIs: Registered · Served (unique) · Services delivered · Currently on site (registered minus checked out) · Salvations/Rededications · Medical referrals. | P0 |
| FR-9.2 | Per-station cards: served, pending, avg service time, active volunteers, stock remaining. | P0 |
| FR-9.3 | Arrivals-per-hour chart and services-per-hour by station. | P1 |
| FR-9.4 | Demographics: gender, age ranges, top communities. | P1 |
| FR-9.5 | Volunteer activity: who is signed in, at which station, records today, last seen. | P1 |
| FR-9.6 | Device sync health: number of devices with unsynced records and how old they are. | P0 |
| FR-9.7 | Data-quality panel: possible duplicates to merge, cards voided, missing consent. | P1 |

### 7.10 Follow-up pipeline
| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | Follow-ups are auto-created from Salvation/Rededication, "wants follow-up", counselling follow-up, urgent risk flags and medical referrals. | P0 |
| FR-10.2 | Follow-up list: filter by type, status (New → Assigned → Contacted → Completed / Unreachable) and assignee. | P0 |
| FR-10.3 | Assign to a follow-up team member; log call outcomes and notes; one-tap **Call** and **WhatsApp** links (`tel:` and `wa.me`). | P0 |
| FR-10.4 | Only people who gave **follow-up consent** appear with contact details. | P0 |
| FR-10.5 | Bulk SMS thank-you/invite via a Nigerian SMS gateway (e.g. Termii), consent-filtered. | P2 |

### 7.11 Reports and exports
| ID | Requirement | Priority |
|---|---|---|
| FR-11.1 | **Edition summary report** (on-screen plus PDF): totals, per-station breakdown, demographics, stock used, follow-ups, volunteer count, hourly flow. Branded. | P0 |
| FR-11.2 | **Exports** to XLSX and CSV: beneficiaries, visits, per-station services, inventory movement, follow-ups. Confidential fields are excluded unless the exporter holds the relevant role, and the export is audit-logged. | P0 |
| FR-11.3 | **Year-on-year comparison** across editions. | P1 |
| FR-11.4 | Printable **per-person summary** (for a referral letter from the Medical station). | P1 |

### 7.12 Volunteer access and management
| ID | Requirement | Priority |
|---|---|---|
| FR-12.1 | Volunteers join with **edition station PIN or join QR, then their name and phone**. No email or password. The session lasts the event day. | P0 |
| FR-12.2 | Medical and Counselling stations need an extra **role PIN** held by the Station Lead, so confidential access is deliberate. | P0 |
| FR-12.3 | Coordinators can move a volunteer to another station, end their session, or revoke a device. | P0 |
| FR-12.4 | Admins (Super Admin, Coordinator, Follow-up team, Viewer) log in with email + password or magic link. | P0 |
| FR-12.5 | Pre-register volunteers before the day (name, phone, station) and send their join link via WhatsApp. | P1 |

### 7.13 Offline and sync
| ID | Requirement | Priority |
|---|---|---|
| FR-13.1 | The app installs as a PWA and loads with **no network** after the first visit. | P0 |
| FR-13.2 | Registrations and service records save locally first (instant), then sync in the background when the network returns. | P0 |
| FR-13.3 | Each device keeps a local cache of the edition's beneficiaries (name, code, needs, timeline summaries) so lookup works offline. | P0 |
| FR-13.4 | A visible **sync indicator**: Online & synced / Offline: N pending / Syncing / Error. | P0 |
| FR-13.5 | Conflict handling: service records are append-only (no conflicts). For beneficiary detail edits, last write wins per field, and every change is kept in the audit log. | P0 |
| FR-13.6 | Offline-created card codes come from a **code block reserved per device** while online, so they never collide. | P1 |

### 7.14 Audit and data governance
| ID | Requirement | Priority |
|---|---|---|
| FR-14.1 | Audit log of create, edit, delete, export and confidential-view events (who, when, device, before/after). | P0 |
| FR-14.2 | Soft delete only; Super Admin can permanently purge on a data-subject request. | P0 |
| FR-14.3 | Retention setting per edition (default: confidential notes auto-redacted 24 months after close; aggregates kept forever). | P1 |
| FR-14.4 | Beneficiary data-subject request: export or delete one person's data. | P1 |

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | First load under 3 s on 3G after install; scan-to-profile under 1.5 s offline; save under 300 ms locally. |
| **Devices** | Android 9+ Chrome on low-end phones (2 GB RAM), iOS Safari 16+, desktop Chrome/Edge. Portrait-first for volunteers. |
| **Scale** | Up to 5,000 beneficiaries per edition, 150 concurrent volunteer devices, 30,000 service records per edition. |
| **Availability** | Event day must work at 99.9% from the user's point of view; offline mode covers network loss. |
| **Outdoor use** | Light theme by default with high contrast for sunlight readability; touch targets at least 48 px; no small grey text. |
| **Accessibility** | WCAG 2.2 AA; works with large system font sizes; never rely on colour alone. |
| **Privacy** | NDPA 2023 (Nigeria Data Protection Act): consent, purpose limitation, minimisation, role-based access, encryption in transit (TLS) and at rest. Confidential notes protected by row-level security. |
| **Security** | RLS on every table; server-side checks on every mutation; rate-limited PIN joins; PIN lockout after 5 failed attempts; session revocation; no personal data in URLs or QR codes. |
| **Localisation** | UI strings externalised (i18n-ready); English in v1, with Pidgin and Hausa planned. Dates in `Africa/Lagos`. |
| **Battery / data** | Minimal background polling; realtime via websocket; images not loaded by default. |

---

## 9. Success metrics

| Metric | Target |
|---|---|
| Average registration time | ≤ 60 s |
| Average station lookup time | ≤ 5 s (scan) |
| Share of services recorded digitally (vs paper fallback) | ≥ 95% |
| Time from event close to final report | 0 hours (instant) vs weeks before |
| Duplicate beneficiary rate | ≤ 2% |
| Follow-ups contacted within 7 days | ≥ 80% |
| Volunteer satisfaction ("easier than paper") | ≥ 4/5 |

---

## 10. Release scope

### MVP (must ship before the event)
Edition setup with default stations · card batch and PDF printing · registration with consent and duplicate check · scan and search lookup · profile and live timeline · Prayer, Counselling, Medical, Food and Clothing forms · pending lists · basic inventory decrement · live dashboard KPIs and station cards · follow-up list (auto-created, assign, log outcome) · XLSX/CSV export plus summary report · PIN-based volunteer join · offline-first with sync · RLS and audit log.

### v1.1 (after the first edition)
Custom station form builder · family registration · YoY comparison · charts and demographics · pre-registering volunteers with WhatsApp links · low-stock alerts · device code blocks · retention automation.

### Later
SMS campaigns · public queue display · photo capture · multi-language UI · multi-campus / multi-organisation SaaS (Geetek can commercialise this for other churches and NGOs).

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Poor network at the venue | Offline-first PWA; a dedicated MiFi/hotspot for key devices; sync health on the dashboard |
| Volunteers unfamiliar with the app | One-screen station loop; a 10-minute training mode with demo data; printed one-page quick guide per station |
| Phones run out of battery | Power banks at every station; the app's dark header and low background activity save battery; paper fallback sheet with a later "bulk entry" screen |
| Sensitive data exposure | RLS, role PINs, confidential notes in a separate table, audit of views, no personal data in exports by default |
| Cards lost or swapped | Search by name/phone; card void and replace; age range and community shown to confirm identity |
| Run out of pre-printed cards | Print 30% extra; on-the-spot code generation (FR-2.5) |
| Duplicate registrations | Live duplicate check; merge tool for coordinators |

---

## 12. Open questions (confirm with the outreach team)

1. Event date, venue and expected turnout? (Sizes the card batch and devices.)
2. How many devices will volunteers bring, and will the church provide tablets for Registration and Medical?
3. Do medical volunteers want specific forms (e.g. a hospital referral letter template)?
4. Which follow-up structure exists after the event (home cells, follow-up department)?
5. Do we need a checkout/exit station this year?
6. Is SMS thank-you wanted, and who funds the SMS units?
7. Hosting budget: Supabase free tier vs Pro ($25/month) during the event month.
