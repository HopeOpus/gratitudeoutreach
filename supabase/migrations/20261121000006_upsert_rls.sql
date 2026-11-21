-- Idempotent sync uses INSERT ... ON CONFLICT DO NOTHING, and Postgres applies the
-- SELECT policy to the proposed row in that case. Two narrow additions make the
-- outbox work without widening what volunteers can read:
--  1. a registration session may see beneficiaries of its org that have NO visit yet
--     (only the in-flight registration between its two inserts);
--  2. a session may see flags it created itself (e.g. a leads-only card-conflict flag).

drop policy beneficiaries_select on public.beneficiaries;
create policy beneficiaries_select on public.beneficiaries for select to authenticated
  using (
    app.is_org_member(org_id, '{super_admin,coordinator}')
    or exists (select 1 from public.visits v
               where v.beneficiary_id = beneficiaries.id and v.edition_id = (select app.session_edition()))
    or (app.is_org_member(org_id, '{followup}')
        and exists (select 1 from public.visits v
                    where v.beneficiary_id = beneficiaries.id and v.consent_followup_at is not null))
    or ((select app.session_kind()) = 'registration'
        and org_id = (select app.session_org())
        and not exists (select 1 from public.visits v where v.beneficiary_id = beneficiaries.id))
  );

drop policy flags_select on public.flags;
create policy flags_select on public.flags for select to authenticated
  using (
    app.is_edition_role(edition_id, '{super_admin,coordinator,followup}')
    or (edition_id = (select app.session_edition())
        and (scope = 'all'
             or scope::text = (select app.session_kind())::text
             or (scope = 'leads' and (select app.session_is_lead()))
             or created_by_session = (select app.session_id())))
  );
