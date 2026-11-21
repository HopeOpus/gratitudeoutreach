"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, AlertTriangle, CornerDownRight, Ban, Pencil, CreditCard, LogOut, ClipboardPen, Lock, Plus } from "lucide-react";
import type { VolunteerSession } from "@/lib/offline/session";
import { useStations, useVisit, useVisitConfidential, useVisitFlags, useVisitNeeds, useVisitRecords } from "@/lib/offline/hooks";
import { setNeed, patchBeneficiary, replaceCard, checkOut } from "@/lib/offline/mutations";
import { volunteerClient } from "@/lib/supabase/volunteer";
import { navigate, back } from "../nav";
import { useScan } from "../scan-context";
import { NeedChip, TimelineItem, ReturningBadge, metaLine, LockedNote } from "../bits";
import { setOverride } from "../override";
import { Button } from "@/components/ui/button";
import { AlertBanner, CodeBadge, EmptyState, Skeleton, Card } from "@/components/ui/misc";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input, Field } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { toast } from "@/components/ui/toast";
import { cn, firstName, formatTime, errorMessage } from "@/lib/utils";
import { parseCardPayload } from "@/lib/cards";
import { abnormalVitals } from "@/lib/vitals";
import { isConfidentialKind } from "@/lib/stations";
import type { LocalFlag } from "@/lib/offline/db";

const DECLINE_REASONS = ["Out of stock", "Person left", "Not eligible today", "Person declined", "Other"];

export function ProfileView({ visitId, session }: { visitId: string; session: VolunteerSession }) {
  const visit = useVisit(visitId);
  const needs = useVisitNeeds(visitId);
  const records = useVisitRecords(visitId);
  const flags = useVisitFlags(visitId);
  const confidential = useVisitConfidential(visitId);
  const stations = useStations();
  const { readOnly } = useScan();
  const [sheet, setSheet] = useState<null | "menu" | "refer" | "decline" | "again" | "override" | "edit" | "card" | "needs">(null);
  const seen = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  // Highlight records that arrive while the profile is open (FR-5.5).
  useEffect(() => {
    if (!records) return;
    if (!seen.current) { seen.current = new Set(records.map((r) => r.id)); return; }
    const added = records.filter((r) => !seen.current!.has(r.id)).map((r) => r.id);
    if (added.length) {
      added.forEach((id) => seen.current!.add(id));
      setFreshIds(new Set(added));
      const t = setTimeout(() => setFreshIds(new Set()), 2200);
      return () => clearTimeout(t);
    }
  }, [records]);

  const stationById = useMemo(() => new Map(stations.map((s) => [s.id, s])), [stations]);
  const serviceStations = stations.filter((s) => s.is_service && s.enabled);
  const needByStation = useMemo(() => new Map(needs.map((n) => [n.station_id, n])), [needs]);
  const myStation = session.station;
  const isReg = myStation.kind === "registration";
  const mine = (records ?? []).filter((r) => r.station_id === myStation.id);
  const lastMine = mine[0];
  const myNeed = needByStation.get(myStation.id);

  if (visit === undefined || records === undefined) return <div className="flex flex-col gap-3 p-4"><Skeleton className="h-20" /><Skeleton className="h-12" /><Skeleton className="h-48" /></div>;
  if (visit === null) return <EmptyState title="Person not found on this phone" body="They may have been registered on another device. Connect to the internet and search again." action={<Button onClick={() => navigate("/s/search")}>Search</Button>} />;

  const name = firstName(visit.full_name);
  const referralFlag = flags.find((f) => f.kind === "referral" && f.text.includes(`to ${myStation.name}`));
  const otherFlags = flags.filter((f) => f !== referralFlag);
  const myConfidential = isConfidentialKind(myStation.kind) ? confidential.filter((c) => c.kind === myStation.kind) : [];
  const lastVitals = myStation.kind === "medical" ? myConfidential.map((c) => c.payload.vitals as Record<string, number> | undefined).find(Boolean) : undefined;

  const startServe = () => {
    if (lastMine) { setSheet("again"); return; }
    navigate(`/s/p/${visit.id}/serve`);
  };

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      <div className="flex items-center justify-between px-2 pt-2">
        <Button variant="ghost" onClick={() => back()} aria-label="Back"><ArrowLeft className="size-5" /> Back</Button>
        <Button variant="ghost" size="icon" aria-label="More actions" onClick={() => setSheet("menu")}><MoreVertical className="size-5" /></Button>
      </div>

      <section className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h2 font-medium text-forest">{visit.full_name}</h2>
          {visit.returning && <ReturningBadge />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-body text-neutral-700">
          <CodeBadge code={visit.card_code} />
          <span>{metaLine(visit)}</span>
        </div>
        {(visit.language || visit.guardian_name) && (
          <p className="mt-1 text-caption text-neutral-500">
            {visit.language && <>Language: {visit.language}</>}{visit.language && visit.guardian_name && " · "}{visit.guardian_name && <>Guardian: {visit.guardian_name}</>}
          </p>
        )}
        {visit.status === "checked_out" && <p className="mt-1 text-caption text-neutral-500">Checked out at {formatTime(visit.checked_out_at)}</p>}
      </section>

      <div className="flex flex-col gap-2 px-4">
        {referralFlag && <AlertBanner tone="info"><CornerDownRight className="mr-1 inline size-4" aria-hidden />{referralFlag.text} at {formatTime(referralFlag.created_at)}</AlertBanner>}
        {otherFlags.map((f) => <FlagBanner key={f.id} flag={f} />)}
        {lastVitals && abnormalVitals(lastVitals).length > 0 && (
          <AlertBanner tone="warning">Earlier reading: {abnormalVitals(lastVitals).join(", ")}</AlertBanner>
        )}
      </div>

      <section className="px-4 py-4" aria-labelledby="needs-h">
        <h3 id="needs-h" className="mb-2 text-label font-medium text-neutral-700">Needs</h3>
        <div className="flex flex-wrap gap-2">
          {serviceStations.filter((s) => needByStation.has(s.id)).map((s) => <NeedChip key={s.id} station={s} need={needByStation.get(s.id)} />)}
          {needs.length === 0 && <p className="text-body text-neutral-500">No needs recorded.</p>}
        </div>
      </section>

      <section className="flex-1 border-t border-neutral-100 bg-white px-4 py-3" aria-labelledby="tl-h">
        <h3 id="tl-h" className="text-label font-medium text-neutral-700">Today</h3>
        <ol aria-live="polite" className="divide-y divide-neutral-50">
          {records.map((r) => <TimelineItem key={r.id} record={r} station={stationById.get(r.station_id)} fresh={freshIds.has(r.id)} />)}
          <li className="flex gap-3 py-3 pl-1">
            <span className="mt-1.5 size-3 shrink-0 rounded-full bg-st-registration" aria-hidden />
            <div className="flex-1">
              <div className="flex items-center"><span className="text-label font-medium text-forest">Registered</span><span className="ml-auto text-caption text-neutral-500 tabular">{formatTime(visit.registered_at)}</span></div>
              <p className="text-caption text-neutral-500">by {visit.registered_by_name ?? "Registration"}{visit._local ? " · saved on this phone" : ""}</p>
            </div>
          </li>
        </ol>
        {isConfidentialKind(myStation.kind) && myConfidential.length > 0 && (
          <Card className="mt-3 border-confidential/20 bg-confidential-bg p-3">
            <p className="mb-1 inline-flex items-center gap-1 text-label font-medium text-confidential"><Lock className="size-4" aria-hidden /> Private {myStation.kind} notes</p>
            {myConfidential.map((c) => (
              <p key={c.service_record_id} className="text-body text-ink">
                {myStation.kind === "counselling" ? String(c.payload.notes ?? "") :
                  [((c.payload.complaint as string[] | undefined) ?? []).join(", "), c.payload.impression as string | undefined].filter(Boolean).join(" · ")}
              </p>
            ))}
            <LockedNote kind={myStation.kind as "medical" | "counselling"} />
          </Card>
        )}
      </section>

      {!readOnly && (
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-neutral-100 bg-white p-3 safe-bottom">
          {isReg ? (
            <Button size="lg" block onClick={() => setSheet("needs")}><ClipboardPen className="size-5" /> Update needs</Button>
          ) : (
            <Button size="lg" block onClick={startServe} variant={lastMine ? "secondary" : "primary"}>
              {lastMine ? `Already served at ${formatTime(lastMine.served_at)} · Record again?` : `Record ${myStation.name} service`}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setSheet("refer")}><CornerDownRight className="size-5" /> Refer</Button>
            {!isReg && myNeed?.state !== "served" && (
              <Button variant="secondary" className="flex-1" onClick={() => setSheet("decline")}><Ban className="size-5" /> Not available</Button>
            )}
          </div>
        </div>
      )}

      <BottomSheet open={sheet === "menu"} onOpenChange={(o) => !o && setSheet(null)} title={visit.full_name}>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="lg" block className="justify-start" disabled={readOnly} onClick={() => setSheet("edit")}><Pencil className="size-5" /> Edit details</Button>
          <Button variant="secondary" size="lg" block className="justify-start" disabled={readOnly} onClick={() => setSheet("card")}><CreditCard className="size-5" /> Replace lost card</Button>
          {(myStation.kind === "checkout" || isReg) && visit.status === "active" && (
            <Button variant="secondary" size="lg" block className="justify-start" disabled={readOnly}
              onClick={async () => { await checkOut(visit); setSheet(null); toast.saved(`Checked out · ${name}`); }}><LogOut className="size-5" /> Check out</Button>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "refer"} onOpenChange={(o) => !o && setSheet(null)} title={`Refer ${name} to…`} description="Creates a pending need at that station.">
        <div className="grid grid-cols-2 gap-2">
          {serviceStations.filter((s) => s.id !== myStation.id).map((s) => (
            <Button key={s.id} variant="secondary" size="lg" onClick={async () => { await setNeed(visit, s.id, "referred"); setSheet(null); toast.saved(`Referred ${name} to ${s.name}`); }}>{s.name}</Button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "decline"} onOpenChange={(o) => !o && setSheet(null)} title={`${myStation.name} not available`} description="Pick a reason. The person leaves this station's pending list.">
        <div className="flex flex-col gap-2">
          {DECLINE_REASONS.map((r) => (
            <Button key={r} variant="secondary" size="lg" block onClick={async () => { await setNeed(visit, myStation.id, "declined", r); setSheet(null); toast.saved(`Marked not available · ${name}`); navigate("/s", { replace: true }); }}>{r}</Button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "again"} onOpenChange={(o) => !o && setSheet(null)} title="Already served"
        description={`${name} was served here at ${formatTime(lastMine?.served_at)} by ${lastMine?.served_by_name}.${myStation.kind === "food" ? " Food a second time needs a Station Lead." : ""}`}>
        <div className="flex flex-col gap-2">
          {myStation.kind === "food" ? (
            <Button size="lg" block onClick={() => setSheet("override")}>Ask Station Lead to approve</Button>
          ) : (
            <Button size="lg" block onClick={() => { setSheet(null); navigate(`/s/p/${visit.id}/serve`); }}>Record again</Button>
          )}
          <Button variant="secondary" size="lg" block onClick={() => setSheet(null)}>Cancel</Button>
        </div>
      </BottomSheet>

      <LeadOverrideSheet open={sheet === "override"} onClose={() => setSheet(null)} session={session}
        onApproved={(token) => { setOverride(visit.id, token); setSheet(null); navigate(`/s/p/${visit.id}/serve`); }} />
      <EditSheet open={sheet === "edit"} onClose={() => setSheet(null)} visit={visit} />
      <ReplaceCardSheet open={sheet === "card"} onClose={() => setSheet(null)} visitId={visit.id} prefix={session.edition.code_prefix}
        onReplace={async (code) => { await replaceCard(visit, code); setSheet(null); toast.saved(`New card ${code} for ${name}`); }} />
      <NeedsSheet open={sheet === "needs"} onClose={() => setSheet(null)} stations={serviceStations} active={needByStation}
        onToggle={async (stationId, on) => { await setNeed(visit, stationId, on ? "pending" : "declined", on ? undefined : "Removed at registration"); }} />
    </div>
  );
}

function FlagBanner({ flag }: { flag: LocalFlag }) {
  const tone = flag.scope === "leads" || flag.kind === "urgent_counselling" ? "danger" : flag.scope === "medical" || flag.scope === "counselling" ? "confidential" : "warning";
  return <AlertBanner tone={tone}><AlertTriangle className="mr-1 hidden size-4" aria-hidden />{flag.text}</AlertBanner>;
}

function LeadOverrideSheet({ open, onClose, session, onApproved }: { open: boolean; onClose: () => void; session: VolunteerSession; onApproved: (token: string) => void }) {
  const [pin, setPin] = useState("");
  const [leadName, setLeadName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const online = typeof navigator !== "undefined" && navigator.onLine;
  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await (await volunteerClient()).rpc("request_lead_override", { p_pin: pin });
      if (error) throw error;
      const res = data as { override_id?: string; error?: string };
      if (res.override_id) onApproved(res.override_id);
      else setErr(res.error === "locked" ? "Too many tries. Wait 5 minutes." : "That Lead PIN is not right.");
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Station Lead approval" description={online ? "The Station Lead enters their 6-digit Lead PIN." : "You're offline. The Station Lead writes their name. This will be reviewed later."}>
      {online ? (
        <div className="flex flex-col gap-3">
          <Field label="Lead PIN" htmlFor="lead-pin" error={err ?? undefined}>
            <Input id="lead-pin" inputMode="numeric" maxLength={6} type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Button size="lg" block loading={busy} disabled={pin.length !== 6} onClick={() => void submit()}>Approve</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Station Lead name" htmlFor="lead-name">
            <Input id="lead-name" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
          </Field>
          <Button size="lg" block disabled={leadName.trim().length < 2} onClick={() => onApproved(`offline:${leadName.trim().slice(0, 40)} via ${session.session.display_name}`)}>Approve offline</Button>
        </div>
      )}
    </BottomSheet>
  );
}

function EditSheet({ open, onClose, visit }: { open: boolean; onClose: () => void; visit: NonNullable<ReturnType<typeof useVisit>> }) {
  const [name, setName] = useState(visit.full_name);
  const [phone, setPhone] = useState("");
  const [community, setCommunity] = useState(visit.community ?? "");
  const save = async () => {
    try {
      await patchBeneficiary(visit, {
        full_name: name !== visit.full_name ? name : undefined,
        community: community !== (visit.community ?? "") ? community : undefined,
        phone: phone ? phone : undefined,
      });
      onClose();
      toast.saved(`Details updated · ${firstName(name)}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Edit details" description="Changes are logged.">
      <div className="flex flex-col gap-3">
        <Field label="Full name" htmlFor="e-name"><Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="New phone number" htmlFor="e-phone" hint={visit.phone_last4 ? `Current ends in ${visit.phone_last4}` : "No phone saved"}>
          <Input id="e-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" />
        </Field>
        <Field label="Community" htmlFor="e-comm"><Input id="e-comm" value={community} onChange={(e) => setCommunity(e.target.value)} /></Field>
        <Button size="lg" block disabled={name.trim().length < 2} onClick={() => void save()}>Save changes</Button>
      </div>
    </BottomSheet>
  );
}

function ReplaceCardSheet({ open, onClose, onReplace, prefix }: { open: boolean; onClose: () => void; visitId: string; prefix: string; onReplace: (code: string) => void }) {
  const [code, setCode] = useState("");
  const parsed = parseCardPayload(code.includes("-") ? code : `${prefix}-${code}`);
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Replace lost card" description="The old card will be voided. Type the new card's code.">
      <div className="flex flex-col gap-3">
        <Field label="New card code" htmlFor="new-card" hint={`e.g. ${prefix}-0142`}>
          <Input id="new-card" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={`${prefix}-0000`} autoCapitalize="characters" />
        </Field>
        <Button size="lg" block disabled={!parsed} onClick={() => parsed && onReplace(parsed)}>Link new card</Button>
      </div>
    </BottomSheet>
  );
}

function NeedsSheet({ open, onClose, stations, active, onToggle }: {
  open: boolean; onClose: () => void; stations: ReturnType<typeof useStations>; active: Map<string, { state: string }>; onToggle: (id: string, on: boolean) => Promise<void>;
}) {
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Update needs">
      <ChipGroup label="Needs" className="mb-4">
        {stations.map((s) => {
          const st = active.get(s.id)?.state;
          const on = st === "pending" || st === "referred" || st === "served";
          return (
            <Chip key={s.id} size="lg" selected={on} disabled={st === "served"} onToggle={() => void onToggle(s.id, !on)}>
              {st === "served" ? `${s.name} ✓` : s.name}
            </Chip>
          );
        })}
      </ChipGroup>
      <Button size="lg" block onClick={onClose}><Plus className={cn("hidden")} />Done</Button>
    </BottomSheet>
  );
}
