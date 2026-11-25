"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useVisitConfidential, useVisitRecords } from "@/lib/offline/hooks";
import { eyePayloadSchema, EYE_OUTCOMES } from "@/lib/schemas/service";
import type { RxLine } from "@/lib/quick-ticks";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { Toggle } from "@/components/ui/misc";
import { MedicalRecord } from "../medical-record";
import { PrescriptionEditor, useDrugs } from "../rx";
import type { FormProps } from "./types";
import { SaveBar, Section, blockEnter, cleanData } from "./shared";

export function OpticianForm({ visit, stations, saving, onSubmit }: FormProps) {
  const drugs = useDrugs(stations);
  const confidential = useVisitConfidential(visit.id);
  const records = useVisitRecords(visit.id);
  const [right, setRight] = useState("");
  const [left, setLeft] = useState("");
  const [findings, setFindings] = useState("");
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [rx, setRx] = useState<RxLine[]>([]);
  const [back, setBack] = useState(false);
  const pharmacy = stations.find((s) => s.kind === "pharmacy" && s.enabled);
  const doctor = stations.find((s) => s.kind === "medical" && s.enabled);
  const any = !!(right.trim() || left.trim() || findings.trim() || outcomes.length || rx.length);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = eyePayloadSchema.parse(cleanData({
      eye: cleanData({ va_right: right.trim() || undefined, va_left: left.trim() || undefined, findings: findings.trim() || undefined, outcomes }),
      prescription: rx.length ? rx : undefined, refer_to_station_ids: back && doctor ? [doctor.id] : [], designation: "Optician",
    }));
    onSubmit({ summary: "Medical check", data: rx.length && pharmacy ? { refer_to_station_ids: [pharmacy.id] } : {}, confidential: { kind: "medical", payload } });
  };

  return (
    <form onSubmit={submit} onKeyDown={blockEnter} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Only the medical team can see this.</p>
        <MedicalRecord confidential={confidential} records={records ?? []} stations={stations} title="Vital signs and medical record" />
        <Section title="Visual acuity">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span className="text-label text-forest">Right eye</span><Input value={right} maxLength={40} onChange={(e) => setRight(e.target.value)} placeholder="6/6" /></label>
            <label className="flex flex-col gap-1"><span className="text-label text-forest">Left eye</span><Input value={left} maxLength={40} onChange={(e) => setLeft(e.target.value)} placeholder="6/6" /></label>
          </div>
        </Section>
        <Section title="Findings"><Textarea aria-label="Findings" value={findings} maxLength={1000} onChange={(e) => setFindings(e.target.value)} /></Section>
        <Section title="Outcome">
          <ChipGroup label="Outcome">{EYE_OUTCOMES.map((o) => <Chip key={o} size="lg" selected={outcomes.includes(o)} onToggle={() => setOutcomes(outcomes.includes(o) ? outcomes.filter((x) => x !== o) : [...outcomes, o])}>{o}</Chip>)}</ChipGroup>
        </Section>
        {drugs && <PrescriptionEditor drugs={drugs} lines={rx} onChange={setRx} />}
        {doctor && <Toggle label={`Send back to ${doctor.name}`} checked={back} onChange={setBack} />}
      </div>
      <SaveBar saving={saving} disabled={!any} label="Save eye check" hint={!any ? "Record at least one thing" : undefined} />
    </form>
  );
}
