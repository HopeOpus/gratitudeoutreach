"use client";
import { useState } from "react";
import { ChevronDown, Lock, Plus, Trash2 } from "lucide-react";
import { useInventory } from "@/lib/offline/hooks";
import { medicalDataSchema, medicalPayloadSchema, MEDICAL_COMPLAINTS, MEDICAL_TESTS, DESIGNATIONS, type MedicalPayload } from "@/lib/schemas/service";
import { medicalSummary } from "@/lib/summary";
import { bpLevel, rbsLevel, tempLevel, pulseLevel, LEVEL_HINT, abnormalVitals, worstLevel, type VitalLevel, type Vitals } from "@/lib/vitals";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Toggle, AlertBanner } from "@/components/ui/misc";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import type { FormProps } from "./types";
import { MoreOptions, SaveBar, cleanData } from "./shared";

function Step({ title, open, onToggle, children, done }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="rounded-lg border border-neutral-100 bg-white">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-14 w-full items-center justify-between px-4 text-left cursor-pointer">
        <span className="text-body-lg font-medium text-forest">{title}{done && <span className="ml-2 text-caption text-leaf-700">✓ added</span>}</span>
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="flex flex-col gap-4 border-t border-neutral-100 p-4">{children}</div>}
    </section>
  );
}

function VitalField({ label, unit, value, onChange, level, step = "1" }: { label: string; unit: string; value: string; onChange: (v: string) => void; level: VitalLevel; step?: string }) {
  const id = `v-${label.replace(/\W/g, "")}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label font-medium text-forest">{label} <span className="font-normal text-neutral-500">({unit})</span></label>
      <Input id={id} inputMode="decimal" type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("tabular", level === "warning" && "border-2 border-warning", level === "danger" && "border-2 border-danger")} aria-describedby={level !== "normal" ? `${id}-h` : undefined} />
      {level !== "normal" && <p id={`${id}-h`} className={cn("text-caption", level === "danger" ? "text-danger" : "text-warning")}>{LEVEL_HINT[level]}</p>}
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

export function MedicalForm({ session, stations, saving, onSubmit }: FormProps) {
  const meds = useInventory(session.station.id) ?? [];
  const [open, setOpen] = useState<string>("vitals");
  const [v, setV] = useState({ bp_sys: "", bp_dia: "", pulse: "", temp_c: "", weight_kg: "", rbs_mg_dl: "", height_cm: "" });
  const [complaint, setComplaint] = useState<string[]>([]);
  const [complaintText, setComplaintText] = useState("");
  const [tests, setTests] = useState<string[]>([]);
  const [impression, setImpression] = useState("");
  const [dispensed, setDispensed] = useState<{ item_id: string; qty: number; dosage?: string }[]>([]);
  const [pick, setPick] = useState({ item_id: "", qty: 1, dosage: "" });
  const [allergies, setAllergies] = useState("");
  const [referred, setReferred] = useState(false);
  const [referral, setReferral] = useState({ facility: "", reason: "", urgency: "routine" as "routine" | "urgent" });
  const initialDesignation = (DESIGNATIONS as readonly string[]).includes(session.session.designation ?? "") ? (session.session.designation as MedicalPayload["designation"]) : "Other";
  const [designation, setDesignation] = useState<MedicalPayload["designation"]>(initialDesignation);
  const [refer, setRefer] = useState<string[]>([]);

  const vitals: Vitals = { bp_sys: num(v.bp_sys), bp_dia: num(v.bp_dia), pulse: num(v.pulse), temp_c: num(v.temp_c), weight_kg: num(v.weight_kg), rbs_mg_dl: num(v.rbs_mg_dl), height_cm: num(v.height_cm) };
  const abnormal = abnormalVitals(vitals);
  const worst = worstLevel(vitals);
  const toggle = (arr: string[], set: (x: string[]) => void, val: string) => set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  const medName = (id: string) => meds.find((m) => m.id === id)?.name ?? "Item";
  const usedQty = (id: string) => dispensed.filter((d) => d.item_id === id).reduce((n, d) => n + d.qty, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = medicalPayloadSchema.parse(cleanData({
      vitals: Object.fromEntries(Object.entries(vitals).filter(([, x]) => x !== undefined && !Number.isNaN(x))),
      complaint, complaint_text: complaintText || undefined, impression: impression || undefined,
      dispensed: dispensed.map((d) => cleanData(d)), allergies: allergies || undefined, designation,
      referral: referred ? referral : undefined,
    }));
    const data = medicalDataSchema.parse(cleanData({
      tests, referred, referral_urgency: referred ? referral.urgency : undefined,
      items: dispensed.map((d) => ({ item_id: d.item_id, qty: d.qty })), refer_to_station_ids: refer,
    }));
    const flags = allergies.trim() ? [{ kind: "allergy", scope: "medical" as const, text: `Allergy: ${allergies.trim().slice(0, 180)}` }] : [];
    onSubmit({ summary: medicalSummary(data), data, confidential: { kind: "medical", payload }, flags });
  };

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Vitals, complaint and impression are visible to medical staff only.</p>
        {abnormal.length > 0 && <AlertBanner tone={worst === "danger" ? "danger" : "warning"} className="sticky top-30 z-10">Abnormal: {abnormal.join(" · ")}</AlertBanner>}

        <Step title="Vitals" open={open === "vitals"} onToggle={() => setOpen(open === "vitals" ? "" : "vitals")}>
          <div className="grid grid-cols-2 gap-3">
            <VitalField label="BP systolic" unit="mmHg" value={v.bp_sys} onChange={(x) => setV({ ...v, bp_sys: x })} level={bpLevel(vitals.bp_sys, undefined)} />
            <VitalField label="BP diastolic" unit="mmHg" value={v.bp_dia} onChange={(x) => setV({ ...v, bp_dia: x })} level={bpLevel(undefined, vitals.bp_dia)} />
            <VitalField label="Pulse" unit="bpm" value={v.pulse} onChange={(x) => setV({ ...v, pulse: x })} level={pulseLevel(vitals.pulse)} />
            <VitalField label="Temperature" unit="°C" step="0.1" value={v.temp_c} onChange={(x) => setV({ ...v, temp_c: x })} level={tempLevel(vitals.temp_c)} />
            <VitalField label="Weight" unit="kg" step="0.1" value={v.weight_kg} onChange={(x) => setV({ ...v, weight_kg: x })} level="normal" />
            <VitalField label="Blood sugar RBS" unit="mg/dL" value={v.rbs_mg_dl} onChange={(x) => setV({ ...v, rbs_mg_dl: x })} level={rbsLevel(vitals.rbs_mg_dl)} />
            <VitalField label="Height" unit="cm" value={v.height_cm} onChange={(x) => setV({ ...v, height_cm: x })} level="normal" />
          </div>
        </Step>

        <Step title="Complaint" open={open === "complaint"} onToggle={() => setOpen(open === "complaint" ? "" : "complaint")} done={complaint.length > 0}>
          <ChipGroup label="Presenting complaint">{MEDICAL_COMPLAINTS.map((c) => <Chip key={c} selected={complaint.includes(c)} onToggle={() => toggle(complaint, setComplaint, c)}>{c}</Chip>)}</ChipGroup>
          <Textarea value={complaintText} onChange={(e) => setComplaintText(e.target.value)} placeholder="Details (optional)" aria-label="Complaint details" className="min-h-20" />
        </Step>

        <Step title="Tests" open={open === "tests"} onToggle={() => setOpen(open === "tests" ? "" : "tests")} done={tests.length > 0}>
          <ChipGroup label="Tests done">{MEDICAL_TESTS.map((t) => <Chip key={t} selected={tests.includes(t)} onToggle={() => toggle(tests, setTests, t)}>{t}</Chip>)}</ChipGroup>
        </Step>

        <Step title="Impression" open={open === "impression"} onToggle={() => setOpen(open === "impression" ? "" : "impression")} done={!!impression}>
          <Textarea value={impression} onChange={(e) => setImpression(e.target.value)} aria-label="Clinical impression" />
          <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Allergies (creates a medical-only alert)</span>
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Penicillin" /></label>
        </Step>

        <Step title="Dispense" open={open === "dispense"} onToggle={() => setOpen(open === "dispense" ? "" : "dispense")} done={dispensed.length > 0}>
          <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Medicine</span>
            <Select value={pick.item_id} onChange={(e) => setPick({ ...pick, item_id: e.target.value, qty: 1 })} className="h-13 text-body-lg">
              <option value="">Choose…</option>
              {meds.map((m) => {
                const left = m.remaining - usedQty(m.id);
                return <option key={m.id} value={m.id} disabled={left <= 0}>{m.name} — {left <= 0 ? "Out of stock" : `${left} ${m.unit} left${left <= m.low_threshold ? " (low)" : ""}`}</option>;
              })}
            </Select>
          </label>
          {pick.item_id && (
            <>
              <div className="flex items-end gap-4">
                <div className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Qty</span><Stepper label="quantity" value={pick.qty} onChange={(q) => setPick({ ...pick, qty: q })} max={Math.max(1, (meds.find((m) => m.id === pick.item_id)?.remaining ?? 1) - usedQty(pick.item_id))} /></div>
                <label className="flex flex-1 flex-col gap-1.5"><span className="text-label font-medium text-forest">Dosage</span><Input value={pick.dosage} onChange={(e) => setPick({ ...pick, dosage: e.target.value })} placeholder="1 tab ×2 daily, 3 days" /></label>
              </div>
              <Button type="button" variant="secondary" onClick={() => { setDispensed([...dispensed, { item_id: pick.item_id, qty: pick.qty, dosage: pick.dosage || undefined }]); setPick({ item_id: "", qty: 1, dosage: "" }); }}><Plus className="size-5" /> Add medicine</Button>
            </>
          )}
          {dispensed.length > 0 && (
            <ul className="divide-y divide-neutral-50 rounded-md border border-neutral-100">
              {dispensed.map((d, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2 text-body">
                  <span className="flex-1">{medName(d.item_id)} ×{d.qty}{d.dosage ? <span className="text-neutral-500"> · {d.dosage}</span> : null}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setDispensed(dispensed.filter((_, j) => j !== i))}><Trash2 className="size-5" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Step>

        <Step title="Referral" open={open === "referral"} onToggle={() => setOpen(open === "referral" ? "" : "referral")} done={referred}>
          <Toggle label="Refer to hospital" checked={referred} onChange={setReferred} />
          {referred && (
            <>
              <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Facility</span><Input value={referral.facility} onChange={(e) => setReferral({ ...referral, facility: e.target.value })} placeholder="e.g. Nyanya General Hospital" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Reason</span><Textarea value={referral.reason} onChange={(e) => setReferral({ ...referral, reason: e.target.value })} className="min-h-20" /></label>
              <Segmented label="Urgency" value={referral.urgency} onChange={(u) => setReferral({ ...referral, urgency: u })} options={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent", tone: "danger" }]} />
            </>
          )}
        </Step>

        <div className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-forest">Attended by ({session.session.display_name})</span>
          <Segmented label="Designation" value={designation} onChange={setDesignation} options={DESIGNATIONS.map((d) => ({ value: d, label: d }))} />
        </div>
        <MoreOptions refer={refer} setRefer={setRefer} stations={stations} currentStationId={session.station.id} />
      </div>
      <SaveBar saving={saving} disabled={referred && (!referral.facility.trim() || !referral.reason.trim())} label="Save medical check" />
    </form>
  );
}
