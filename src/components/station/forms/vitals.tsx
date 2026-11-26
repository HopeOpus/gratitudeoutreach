"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useVisitNeeds } from "@/lib/offline/hooks";
import { vitalsPayloadSchema } from "@/lib/schemas/service";
import { bpLevel, rbsLevel, pulseLevel, LEVEL_HINT, abnormalVitals, worstLevel, type VitalLevel, type Vitals } from "@/lib/vitals";
import { AlertBanner, Toggle } from "@/components/ui/misc";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FormProps } from "./types";
import { SaveBar, Section, cleanData } from "./shared";

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

const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));
const FIELD_NAMES: Record<string, string> = { bp_sys: "BP systolic", bp_dia: "BP diastolic", pulse: "Pulse", temp_c: "Temperature", weight_kg: "Weight", rbs_mmol_l: "Blood sugar", height_cm: "Height" };

/** Medical Assistant: vital signs. They become part of the medical record the doctor sees. */
export function VitalsForm({ visit, stations, saving, onSubmit }: FormProps) {
  const doctor = stations.find((s) => s.kind === "medical" && s.enabled);
  const needs = useVisitNeeds(visit.id);
  const doctorNeed = doctor && needs.find((n) => n.station_id === doctor.id);
  const alreadyWaiting = doctorNeed?.state === "pending" || doctorNeed?.state === "referred";
  const [v, setV] = useState({ bp_sys: "", bp_dia: "", pulse: "", temp_c: "", weight_kg: "", rbs_mmol_l: "", height_cm: "" });
  const [notes, setNotes] = useState("");
  const [send, setSend] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vitals: Vitals = { bp_sys: num(v.bp_sys), bp_dia: num(v.bp_dia), pulse: num(v.pulse), temp_c: num(v.temp_c), weight_kg: num(v.weight_kg), rbs_mmol_l: num(v.rbs_mmol_l), height_cm: num(v.height_cm) };
  const any = Object.values(vitals).some((x) => x !== undefined);
  const abnormal = abnormalVitals(vitals);
  const toDoctor = send ?? abnormal.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = vitalsPayloadSchema.safeParse(cleanData({ vitals: cleanData(vitals as Record<string, unknown>), notes: notes.trim() || undefined, designation: "Nurse" }));
    if (!parsed.success) {
      const key = String(parsed.error.issues[0]?.path.at(-1) ?? "");
      setError(`Check ${FIELD_NAMES[key] ?? "the values"}: that number is not possible.`);
      return;
    }
    setError(null);
    onSubmit({
      summary: "Vital signs taken",
      data: doctor && toDoctor && !alreadyWaiting ? { refer_to_station_ids: [doctor.id] } : {},
      confidential: { kind: "medical", payload: parsed.data },
    });
  };

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Only the medical team can see these.</p>
        {abnormal.length > 0 && <AlertBanner tone={worstLevel(vitals) === "danger" ? "danger" : "warning"}>Abnormal: {abnormal.join(" · ")}</AlertBanner>}
        <Section title="Vital signs">
          <div className="grid grid-cols-2 gap-3">
            <VitalField label="BP systolic" unit="mmHg" value={v.bp_sys} onChange={(x) => setV({ ...v, bp_sys: x })} level={bpLevel(vitals.bp_sys, undefined)} />
            <VitalField label="BP diastolic" unit="mmHg" value={v.bp_dia} onChange={(x) => setV({ ...v, bp_dia: x })} level={bpLevel(undefined, vitals.bp_dia)} />
            <VitalField label="Pulse" unit="bpm" value={v.pulse} onChange={(x) => setV({ ...v, pulse: x })} level={pulseLevel(vitals.pulse)} />
            <VitalField label="Temperature" unit="°C" step="0.1" value={v.temp_c} onChange={(x) => setV({ ...v, temp_c: x })} level="normal" />
            <VitalField label="Weight" unit="kg" step="0.1" value={v.weight_kg} onChange={(x) => setV({ ...v, weight_kg: x })} level="normal" />
            <VitalField label="Blood sugar RBS" unit="mmol/L" step="0.1" value={v.rbs_mmol_l} onChange={(x) => setV({ ...v, rbs_mmol_l: x })} level={rbsLevel(vitals.rbs_mmol_l)} />
            <VitalField label="Height" unit="cm" value={v.height_cm} onChange={(x) => setV({ ...v, height_cm: x })} level="normal" />
          </div>
        </Section>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-medium text-forest">Note for the doctor (optional)</span>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="min-h-20" />
        </label>
        {doctor && (alreadyWaiting
          ? <AlertBanner tone="info">Already waiting for {doctor.name}.</AlertBanner>
          : <Toggle label={`Send to ${doctor.name}`} description="Turns on by itself when a reading is out of range" checked={toDoctor} onChange={setSend} />)}
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      </div>
      <SaveBar saving={saving} disabled={!any} label="Save vital signs" hint={!any ? "Enter at least one reading" : undefined} />
    </form>
  );
}
