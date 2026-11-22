"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CreditCard, Printer, ScanLine, Users, CheckCircle2, UserPlus, QrCode } from "lucide-react";
import type { VolunteerSession } from "@/lib/offline/session";
import { registrationDetailsSchema, type RegistrationDetails, AGE_RANGES, GENDERS, LANGUAGES, CHURCH_MEMBER, COMMUNITIES, isMinor } from "@/lib/schemas/beneficiary";
import { registerPerson, nextOnTheSpotCode, codesLeft, type ExistingBeneficiary } from "@/lib/offline/mutations";
import { QrImage, QrSlip, printSlip } from "../qr-slip";
import { findVisitByCode, useStations } from "@/lib/offline/hooks";
import { db, type LocalVisit } from "@/lib/offline/db";
import { volunteerClient } from "@/lib/supabase/volunteer";
import { useScan } from "../scan-context";
import { navigate } from "../nav";
import { StationIcon, ageLabel, ReturningBadge } from "../bits";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AlertBanner, Checkbox, CodeBadge, Card } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { cn, firstName, normalizePhone, errorMessage, vibrate } from "@/lib/utils";

type Dup = ExistingBeneficiary & { last_edition_name: string | null; last_visit_year: number | null; visit_id_this_edition: string | null; card_code_this_edition: string | null; match_reason: string };

export function RegisterView({ session, initialCard, onCardUsed }: { session: VolunteerSession; initialCard: string | null; onCardUsed: () => void }) {
  const { openScanner } = useScan();
  const stations = useStations();
  const serviceStations = stations.filter((s) => s.is_service && s.enabled);
  const [card, setCard] = useState<string | null>(null);
  const [cardOwner, setCardOwner] = useState<LocalVisit | null>(null);
  const [cardProblem, setCardProblem] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [details, setDetails] = useState<RegistrationDetails | null>(null);
  const [existing, setExisting] = useState<ExistingBeneficiary | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [consentData, setConsentData] = useState(false);
  const [consentFollowup, setConsentFollowup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<LocalVisit | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [printed, setPrinted] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { void codesLeft().then(setLeft); }, []);

  // Accept a scanned/typed card (FR-3.1, FR-2.4).
  useEffect(() => {
    if (!initialCard) return;
    onCardUsed();
    void (async () => {
      setCardProblem(null);
      const prefixOk = initialCard.startsWith(`${session.edition.code_prefix}-`);
      if (!prefixOk) { setCardProblem(`This card is for a different event (${initialCard}).`); return; }
      const owner = await findVisitByCode(initialCard);
      if (owner) { setCardOwner(owner); return; }
      if (navigator.onLine) {
        const { data } = await (await volunteerClient()).from("cards").select("status").eq("edition_id", session.edition.id).eq("code", initialCard).maybeSingle();
        if (data?.status === "void") { setCardProblem(`Card ${initialCard} was voided. Use another card.`); return; }
        if (data?.status === "assigned") { setCardProblem(`Card ${initialCard} is already assigned. Use another card.`); return; }
      }
      setCard(initialCard);
      vibrate(30);
    })();
  }, [initialCard, onCardUsed, session.edition.code_prefix, session.edition.id]);

  const save = async () => {
    if (!details) return;
    setSaving(true);
    try {
      // No pre-printed card: give the person a code now and print it as a QR slip.
      const code = card ?? (await nextOnTheSpotCode());
      if (!code) toast.error("This phone has no QR codes left. Connect to the internet for more, or use pre-printed cards.");
      const visit = await registerPerson({ details, cardCode: code, needStationIds: needs, consentFollowup, existing });
      vibrate(40);
      setDone(visit);
      setPrinted(false);
      void codesLeft().then(setLeft);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCard(null); setCardProblem(null); setStep(1); setDetails(null); setExisting(null); setNeeds([]); setConsentData(false); setConsentFollowup(false); setDone(null); setStartedAt(Date.now());
  };

  if (done) {
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const name = firstName(done.full_name);
    const preprinted = !!done.card_code && done.card_code === card;
    return (
      <div className="flex min-h-[calc(100dvh-56px)] flex-col items-center gap-4 p-6 text-center">
        <p className="inline-flex items-center gap-2 text-h2 font-medium text-forest"><CheckCircle2 className="size-8 text-leaf" aria-hidden /> {name} is registered</p>
        {done.card_code ? (
          <>
            {!preprinted && <QrImage code={done.card_code} className="w-56 rounded-lg p-2 shadow-sm ring-1 ring-neutral-100" />}
            <p className="whitespace-nowrap text-h1 font-light tracking-wider text-forest tabular" data-testid="new-code">{done.card_code}</p>
            <p className="text-body-lg text-neutral-700">{preprinted ? `Give the card to ${name}.` : `Print the QR slip and give it to ${name}. They show it at every stand.`}</p>
          </>
        ) : <AlertBanner tone="warning">No code: stations will need to search for {name} by name.</AlertBanner>}
        <p className="text-caption text-neutral-500">Saved on this phone · {secs}s{left !== null && left < 100 && !preprinted ? ` · ${left} QR codes left on this phone` : ""}</p>
        <div className="flex w-full max-w-sm flex-col gap-2">
          {done.card_code && !preprinted && (
            <Button size="lg" block variant={printed ? "secondary" : "primary"} onClick={() => { printSlip(); setPrinted(true); }}><Printer className="size-5" /> {printed ? "Print again" : "Print QR slip"}</Button>
          )}
          <Button size="lg" block variant={done.card_code && !preprinted && !printed ? "secondary" : "primary"} onClick={reset}><UserPlus className="size-5" /> Next person</Button>
          <Button variant="ghost" size="lg" block onClick={() => navigate(`/s/p/${done.id}`, { replace: true })}>Open profile</Button>
        </div>
        {done.card_code && !preprinted && <QrSlip code={done.card_code} firstName={name} eventName={session.edition.name} />}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-white px-2 py-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2) : navigate("/s", { replace: true }))}><ArrowLeft className="size-5" /></Button>
        <div className="flex flex-1 items-center justify-between gap-2">
          {card ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-leaf-50 px-2 py-1 text-label font-medium tracking-wider text-leaf-700"><Check className="size-4" aria-hidden /><CreditCard className="size-4" aria-hidden />{card}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-caption text-neutral-700"><QrCode className="size-4" aria-hidden /> QR slip is printed after saving</span>
          )}
          {!card && step === 1 && (
            <Button variant="ghost" size="sm" onClick={() => openScanner("register")}><ScanLine className="size-4" /> Use a pre-printed card</Button>
          )}
        </div>
      </div>

      {cardProblem && <AlertBanner tone="danger" className="mx-4 mt-3">{cardProblem}</AlertBanner>}
      {left === 0 && !card && <AlertBanner tone="warning" className="mx-4 mt-3">This phone has no QR codes left. Connect to the internet for more, or use pre-printed cards.</AlertBanner>}
      <div className="px-4 pt-4">
        <p className="text-label text-neutral-700">Step {step} of 3</p>
        <div className="mt-1 flex gap-1" aria-hidden>{[1, 2, 3].map((n) => <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= step ? "bg-leaf" : "bg-neutral-100")} />)}</div>
      </div>
      {step === 1 && (
        <DetailsStep session={session} initial={details} existing={existing}
          onExisting={(b) => setExisting(b)}
          onAlreadyHere={(visitId) => navigate(`/s/p/${visitId}`, { replace: true })}
          onNext={(d) => { setDetails(d); setStep(2); }} />
      )}
      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-3 p-4">
            <h2 className="text-h2 font-medium text-forest">What does {firstName(details?.full_name)} need?</h2>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Needs">
              {serviceStations.map((st) => {
                const on = needs.includes(st.id);
                return (
                  <button key={st.id} type="button" aria-pressed={on} onClick={() => setNeeds(on ? needs.filter((x) => x !== st.id) : [...needs, st.id])}
                    className={cn("relative flex min-h-28 flex-col items-start justify-between rounded-lg border-2 bg-white p-3 text-left cursor-pointer", on ? "border-leaf bg-leaf-50" : "border-neutral-100")}>
                    <StationIcon kind={st.kind} size="lg" />
                    <span className="text-body-lg font-medium text-forest">{st.name}</span>
                    {on && <Check className="absolute right-3 top-3 size-6 text-leaf-600" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="sticky bottom-0 border-t border-neutral-100 bg-white p-3 safe-bottom">
            {needs.length === 0 && <p className="mb-2 text-center text-caption text-neutral-500">Tap every need that applies</p>}
            <Button size="lg" block onClick={() => setStep(3)}>Next <ArrowRight className="size-5" /></Button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 p-4">
            <h2 className="text-h2 font-medium text-forest">Consent</h2>
            <p className="text-caption text-neutral-500">Read this aloud to {firstName(details?.full_name)}{details && isMinor(details.age_range) ? ` and their guardian (${details.guardian_name})` : ""}.</p>
            <div className="rounded-lg bg-neutral-50 p-4 text-body-lg text-ink">{session.org.consent_text}</div>
            <Checkbox id="c-data" required checked={consentData} onChange={setConsentData} label="Agrees to us recording their details" description="Required to register." />
            <Checkbox id="c-fu" checked={consentFollowup} onChange={setConsentFollowup} label="Agrees to be contacted for follow-up" description="Optional. Call or WhatsApp after the event." />
          </div>
          <div className="sticky bottom-0 border-t border-neutral-100 bg-white p-3 safe-bottom">
            <Button size="lg" block disabled={!consentData} loading={saving} onClick={() => void save()}>Save registration</Button>
          </div>
        </div>
      )}

      <BottomSheet open={!!cardOwner} onOpenChange={(o) => !o && setCardOwner(null)} title={`Card already belongs to ${cardOwner ? `${firstName(cardOwner.full_name)} ${cardOwner.full_name.split(" ").slice(-1)[0]?.[0] ?? ""}.` : ""}`}
        description="This card is linked to someone already. Open their profile, scan another card, or continue and print a QR slip.">
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={() => cardOwner && navigate(`/s/p/${cardOwner.id}`, { replace: true })}>Open profile</Button>
          <Button variant="secondary" size="lg" block onClick={() => { setCardOwner(null); openScanner("register"); }}>Scan another</Button>
          <Button variant="ghost" size="lg" block onClick={() => setCardOwner(null)}>Continue without a card</Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function DetailsStep({ session, initial, existing, onExisting, onAlreadyHere, onNext }: {
  session: VolunteerSession; initial: RegistrationDetails | null; existing: ExistingBeneficiary | null;
  onExisting: (b: ExistingBeneficiary | null) => void; onAlreadyHere: (visitId: string) => void; onNext: (d: RegistrationDetails) => void;
}) {
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<RegistrationDetails>({
    resolver: zodResolver(registrationDetailsSchema),
    defaultValues: initial ?? { full_name: "", phone: "", community: "", household_size: 1 },
  });
  const [more, setMore] = useState(false);
  const [dups, setDups] = useState<Dup[]>([]);
  const [dupOpen, setDupOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string>("");
  const name = watch("full_name");
  const phone = watch("phone");
  const age = watch("age_range");
  const key = `${name}|${phone}`;

  // Live duplicate check (FR-3.6): server across editions when online, local cache otherwise.
  useEffect(() => {
    if (existing || (name?.trim().length ?? 0) < 3) { setDups([]); return; }
    const t = setTimeout(async () => {
      const p = normalizePhone(phone);
      if (navigator.onLine) {
        const { data } = await (await volunteerClient()).rpc("find_duplicates", { p_edition: session.edition.id, p_name: name.trim(), p_phone: p ?? undefined });
        if (data) { setDups(data as unknown as Dup[]); return; }
      }
      const all = await db().visits.toArray();
      const n = name.trim().toLowerCase();
      setDups(all.filter((v) => v.full_name.toLowerCase() === n || (p && v.phone_last4 === p.slice(-4) && v.full_name.toLowerCase().split(" ")[0] === n.split(" ")[0]))
        .slice(0, 5).map((v) => ({ beneficiary_id: v.beneficiary_id, full_name: v.full_name, age_range: v.age_range, gender: v.gender, community: v.community, language: v.language,
          phone_last4: v.phone_last4, returning: v.returning, last_edition_name: null, last_visit_year: null, visit_id_this_edition: v.id, card_code_this_edition: v.card_code, match_reason: "name" })));
    }, 450);
    return () => clearTimeout(t);
  }, [name, phone, existing, session.edition.id]);

  const showDupBanner = dups.length > 0 && dismissed !== key && !existing;
  const communities = useMemo(() => [...COMMUNITIES], []);

  return (
    <form onSubmit={handleSubmit(onNext)} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 p-4">
        {existing && (
          <AlertBanner tone="info" action={<button type="button" className="text-label font-medium underline cursor-pointer" onClick={() => onExisting(null)}>Undo</button>}>
            Linked to existing person {existing.full_name}{existing.returning ? " (returning)" : ""}. A new visit will be created.
          </AlertBanner>
        )}
        {showDupBanner && (
          <AlertBanner tone="warning" action={<Button size="sm" variant="secondary" type="button" onClick={() => setDupOpen(true)}>Check</Button>}>
            <Users className="mr-1 inline size-4" aria-hidden />Possible match: {dups.length} {dups.length === 1 ? "person" : "people"}
          </AlertBanner>
        )}
        <Field label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="off" autoCapitalize="words" {...register("full_name")} invalid={!!errors.full_name} />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={errors.phone?.message} hint="Nigerian number, e.g. 0803 123 4567">
          <div className="flex gap-2">
            <span className="grid h-13 place-items-center rounded-md border border-neutral-100 bg-neutral-50 px-3 text-body text-neutral-700">+234</span>
            <Input id="phone" inputMode="tel" autoComplete="off" {...register("phone")} invalid={!!errors.phone} />
          </div>
        </Field>
        <Field label="Gender" required error={errors.gender?.message}>
          <Controller control={control} name="gender" render={({ field }) => (
            <Segmented label="Gender" value={field.value} onChange={field.onChange} options={GENDERS.slice(0, 2).map((g) => ({ value: g.value, label: g.label }))} />
          )} />
        </Field>
        <Field label="Age range" required error={errors.age_range?.message}>
          <Controller control={control} name="age_range" render={({ field }) => (
            <ChipGroup label="Age range">{AGE_RANGES.map((a) => <Chip key={a.value} size="lg" selected={field.value === a.value} onToggle={() => field.onChange(a.value)}>{a.label}</Chip>)}</ChipGroup>
          )} />
        </Field>
        {isMinor(age) && (
          <Field label="Guardian name" htmlFor="guardian_name" required error={errors.guardian_name?.message} hint="Child or teen: who is with them today?">
            <Input id="guardian_name" autoCapitalize="words" {...register("guardian_name")} invalid={!!errors.guardian_name} />
          </Field>
        )}
        <Field label="Community" htmlFor="community">
          <Input id="community" list="communities" autoComplete="off" placeholder="Search or type…" {...register("community")} />
          <datalist id="communities">{communities.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="rounded-lg border border-neutral-100 bg-white">
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex min-h-12 w-full items-center justify-between px-4 text-label font-medium text-forest cursor-pointer">
            More (household, language, church member)
            <ChevronDown className={cn("size-5 transition-transform", more && "rotate-180")} aria-hidden />
          </button>
          {more && (
            <div className="flex flex-col gap-4 border-t border-neutral-100 p-4">
              <Field label="Household size">
                <Controller control={control} name="household_size" render={({ field }) => <Stepper label="household size" value={field.value ?? 1} onChange={field.onChange} max={30} />} />
              </Field>
              <Field label="Language">
                <Controller control={control} name="language" render={({ field }) => (
                  <ChipGroup label="Language">{LANGUAGES.map((l) => <Chip key={l} selected={field.value === l} onToggle={() => field.onChange(field.value === l ? undefined : l)}>{l}</Chip>)}</ChipGroup>
                )} />
              </Field>
              <Field label="Church member?">
                <Controller control={control} name="church_member" render={({ field }) => (
                  <Segmented label="Church member" value={field.value} onChange={field.onChange} options={CHURCH_MEMBER.map((c) => ({ value: c.value, label: c.label }))} />
                )} />
              </Field>
            </div>
          )}
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-neutral-100 bg-white p-3 safe-bottom">
        <Button type="submit" size="lg" block>Next <ArrowRight className="size-5" /></Button>
      </div>

      <BottomSheet open={dupOpen} onOpenChange={setDupOpen} title="Is this the same person?" description="Check age range and community before choosing.">
        <ul className="flex flex-col gap-2">
          {dups.map((d) => (
            <li key={d.beneficiary_id}>
              <Card className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-lg font-medium text-forest">{d.full_name}</span>
                  {d.last_visit_year && <ReturningBadge />}
                </div>
                <p className="text-caption text-neutral-700">
                  {[ageLabel(d.age_range), d.community, d.phone_last4 ? `phone …${d.phone_last4}` : null, d.last_visit_year ? `Returning, last visited ${d.last_visit_year}` : null].filter(Boolean).join(" · ")}
                </p>
                {d.visit_id_this_edition ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption text-neutral-500">Already registered today <CodeBadge code={d.card_code_this_edition} /></span>
                    <Button size="sm" variant="secondary" type="button" onClick={() => onAlreadyHere(d.visit_id_this_edition!)}>Open</Button>
                  </div>
                ) : (
                  <Button size="md" type="button" onClick={() => { onExisting({ ...d, returning: !!d.last_visit_year }); setDupOpen(false); }}>Same person</Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="lg" block className="mt-3" type="button" onClick={() => { setDismissed(key); setDupOpen(false); }}>New person</Button>
      </BottomSheet>
    </form>
  );
}
