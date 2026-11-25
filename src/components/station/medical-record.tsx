"use client";
import { Lock } from "lucide-react";
import type { LocalConfidential, LocalRecord, LocalStation } from "@/lib/offline/db";
import { medicalEntries } from "@/lib/medical";
import { abnormalVitals, type Vitals } from "@/lib/vitals";
import { formatTime } from "@/lib/utils";
import { LockedNote } from "./bits";

const VITALS: [keyof Vitals, string, string][] = [
  ["pulse", "Pulse", "bpm"], ["temp_c", "Temperature", "°C"], ["weight_kg", "Weight", "kg"], ["height_cm", "Height", "cm"], ["rbs_mg_dl", "Blood sugar", "mg/dL"],
];

function VitalsList({ v }: { v: Vitals }) {
  const rows: [string, string][] = [];
  if (v.bp_sys != null || v.bp_dia != null) rows.push(["BP", `${v.bp_sys ?? "?"}/${v.bp_dia ?? "?"} mmHg`]);
  for (const [k, label, unit] of VITALS) if (v[k] != null) rows.push([label, `${v[k]} ${unit}`]);
  const abnormal = abnormalVitals(v);
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([l, x]) => <div key={l} className="flex justify-between gap-2"><dt className="text-caption text-neutral-700">{l}</dt><dd className="text-body font-medium tabular text-ink">{x}</dd></div>)}
      </dl>
      {abnormal.length > 0 && <p className="text-caption font-medium text-danger">Out of range: {abnormal.join(", ")}</p>}
    </>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return <p className="text-body text-ink"><span className="text-caption text-neutral-700">{label}: </span>{children}</p>;
}

/** Everything the medical team recorded today: vitals, doctor's notes, lab, eyes. Medical team only. */
export function MedicalRecord({ confidential, records, stations, title = "Private medical notes" }: {
  confidential: LocalConfidential[]; records: LocalRecord[]; stations: LocalStation[]; title?: string;
}) {
  const entries = medicalEntries(confidential, records);
  const names = new Map(stations.map((s) => [s.id, s.name]));
  return (
    <section className="rounded-lg border border-confidential/20 bg-confidential-bg p-3" aria-label={title}>
      <p className="mb-2 inline-flex items-center gap-1 text-label font-medium text-confidential"><Lock className="size-4" aria-hidden /> {title}</p>
      {entries.length === 0 && <p className="text-body text-neutral-700">Nothing recorded yet today.</p>}
      <ul className="flex flex-col gap-2">
        {entries.map(({ id, payload: p, record, at }) => (
          <li key={id} className="flex flex-col gap-1 rounded-md bg-white p-3">
            <p className="text-caption text-neutral-700">{names.get(record.station_id) ?? "Medical"} · {record.served_by_name} · {formatTime(at)}</p>
            {p.vitals && Object.keys(p.vitals).length > 0 && <VitalsList v={p.vitals} />}
            {p.allergies && <Line label="Allergies">{p.allergies}</Line>}
            {((p.complaint?.length ?? 0) > 0 || p.complaint_text) && <Line label="Complaint">{[...(p.complaint ?? []), p.complaint_text].filter(Boolean).join(", ")}</Line>}
            {p.impression && <Line label="Comments">{p.impression}</Line>}
            {p.tests_requested && p.tests_requested.length > 0 && <Line label="Tests requested">{p.tests_requested.join(", ")}</Line>}
            {p.lab_results?.map((r) => <Line key={r.test} label={r.test}>{r.result}{r.abnormal && <span className="font-medium text-danger"> · abnormal</span>}</Line>)}
            {p.eye && (
              <>
                {(p.eye.va_right || p.eye.va_left) && <Line label="Visual acuity">Right {p.eye.va_right ?? "—"} · Left {p.eye.va_left ?? "—"}</Line>}
                {p.eye.findings && <Line label="Eye findings">{p.eye.findings}</Line>}
                {p.eye.outcomes && p.eye.outcomes.length > 0 && <Line label="Eye outcome">{p.eye.outcomes.join(", ")}</Line>}
              </>
            )}
            {p.minor_surgery && <Line label="Minor surgery">{p.minor_surgery === "done" ? "Done" : "Needed"}{p.minor_surgery_note ? ` · ${p.minor_surgery_note}` : ""}</Line>}
            {p.prescription && p.prescription.length > 0 && <Line label="Prescription">{p.prescription.map((l) => `${l.name} × ${l.qty}${l.dosage ? ` (${l.dosage})` : ""}`).join("; ")}</Line>}
            {p.referral && <Line label="Hospital referral">{p.referral.facility} · {p.referral.reason}{p.referral.urgency === "urgent" ? " · urgent" : ""}</Line>}
            {p.notes && <Line label="Notes">{p.notes}</Line>}
          </li>
        ))}
      </ul>
      <div className="mt-2"><LockedNote kind="medical" /></div>
    </section>
  );
}
