"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useVisitConfidential, useVisitRecords } from "@/lib/offline/hooks";
import { labPayloadSchema, MEDICAL_TESTS } from "@/lib/schemas/service";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { AlertBanner, Checkbox, Skeleton } from "@/components/ui/misc";
import { outstandingTests } from "@/lib/medical";
import { MedicalRecord } from "../medical-record";
import type { FormProps } from "./types";
import { SaveBar, Section, blockEnter, cleanData } from "./shared";

/** Laboratory: results for the tests the doctor asked for. Saving sends the person back to the doctor's queue. */
export function LaboratoryForm({ visit, stations, saving, onSubmit }: FormProps) {
  const confidential = useVisitConfidential(visit.id);
  const records = useVisitRecords(visit.id);
  const [results, setResults] = useState<Record<string, { result: string; abnormal: boolean }>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  if (records === undefined) return <div className="p-4"><Skeleton className="h-48" /></div>;

  const requested = outstandingTests(confidential, records);
  const tests = [...requested, ...extra.filter((t) => !requested.includes(t))];
  const filled = tests.filter((t) => results[t]?.result.trim());
  const doctor = stations.find((s) => s.kind === "medical" && s.enabled);
  const set = (t: string, patch: Partial<{ result: string; abnormal: boolean }>) => setResults((r) => ({ ...r, [t]: { ...(r[t] ?? { result: "", abnormal: false }), ...patch } }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = labPayloadSchema.parse(cleanData({
      lab_results: filled.map((t) => ({ test: t, result: results[t]!.result.trim(), abnormal: results[t]!.abnormal })),
      designation: "Lab", notes: notes.trim() || undefined,
    }));
    onSubmit({ summary: "Medical check", data: {}, confidential: { kind: "medical", payload } });
  };

  return (
    <form onSubmit={submit} onKeyDown={blockEnter} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Only the medical team can see results.</p>
        {requested.length === 0 && <AlertBanner tone="info">No test request from the doctor on this phone. If one was made, wait a moment for it to sync.</AlertBanner>}
        {tests.map((t) => (
          <Section key={t} title={t}>
            <Input aria-label={`${t} result`} placeholder="Result" maxLength={300} value={results[t]?.result ?? ""} onChange={(e) => set(t, { result: e.target.value })} />
            <Checkbox id={`ab-${t}`} label="Abnormal" checked={results[t]?.abnormal ?? false} onChange={(on) => set(t, { abnormal: on })} />
          </Section>
        ))}
        <Section title="Add another test">
          <ChipGroup label="Add another test">{MEDICAL_TESTS.filter((t) => !tests.includes(t)).map((t) => <Chip key={t} onToggle={() => setExtra([...extra, t])}>+ {t}</Chip>)}</ChipGroup>
        </Section>
        <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Notes (optional)</span><Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} className="min-h-20" /></label>
        <MedicalRecord confidential={confidential} records={records} stations={stations} title="Vital signs and medical record" />
        {filled.length < requested.length && filled.length > 0 && <AlertBanner tone="warning">{requested.length - requested.filter((t) => filled.includes(t)).length} requested test(s) still have no result. You can save and add them later.</AlertBanner>}
      </div>
      <SaveBar saving={saving} disabled={filled.length === 0} label={doctor ? `Save and send to ${doctor.name}` : "Save results"} hint={filled.length === 0 ? "Enter at least one result" : undefined} />
    </form>
  );
}
