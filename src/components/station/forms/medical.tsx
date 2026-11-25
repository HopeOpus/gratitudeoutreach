"use client";
import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { useVisitConfidential, useVisitRecords } from "@/lib/offline/hooks";
import { medicalDataSchema, medicalPayloadSchema, MEDICAL_COMPLAINTS, MEDICAL_TESTS, DESIGNATIONS, type MedicalPayload } from "@/lib/schemas/service";
import { medicalSummary } from "@/lib/summary";
import type { RxLine } from "@/lib/quick-ticks";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/misc";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MedicalRecord } from "../medical-record";
import { PrescriptionEditor, useDrugs } from "../rx";
import type { FormProps } from "./types";
import { SaveBar, blockEnter, cleanData } from "./shared";

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

/** General Doctor: sees the vitals, writes comments, prescribes, asks for tests and refers. No vitals are entered here. */
export function MedicalForm({ visit, session, stations, saving, onSubmit }: FormProps) {
  const drugs = useDrugs(stations);
  const confidential = useVisitConfidential(visit.id);
  const records = useVisitRecords(visit.id);
  const [open, setOpen] = useState<string>("comments");
  const [complaint, setComplaint] = useState<string[]>([]);
  const [impression, setImpression] = useState("");
  const [allergies, setAllergies] = useState("");
  const [rx, setRx] = useState<RxLine[]>([]);
  const [tests, setTests] = useState<string[]>([]);
  const [otherTest, setOtherTest] = useState("");
  const [toOptician, setToOptician] = useState(false);
  const [surgery, setSurgery] = useState<"no" | "needed" | "done">("no");
  const [surgeryNote, setSurgeryNote] = useState("");
  const [referred, setReferred] = useState(false);
  const [referral, setReferral] = useState({ facility: "", reason: "", urgency: "routine" as "routine" | "urgent" });

  const first = (kind: string) => stations.find((s) => s.kind === kind && s.enabled);
  const lab = first("laboratory");
  const optician = first("optician");
  const pharmacy = first("pharmacy");
  const toggle = (arr: string[], set: (x: string[]) => void, val: string) => set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  const section = (id: string) => ({ open: open === id, onToggle: () => setOpen(open === id ? "" : id) });
  const addOther = () => { const t = otherTest.trim(); if (t && !tests.includes(t)) setTests([...tests, t]); setOtherTest(""); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const typed = otherTest.trim();
    const allTests = typed && !tests.includes(typed) ? [...tests, typed] : tests;
    const referTo = [allTests.length && lab ? lab.id : null, toOptician && optician ? optician.id : null].filter((x): x is string => !!x);
    const own = session.session.designation ?? "";
    const payload = medicalPayloadSchema.parse(cleanData({
      vitals: {}, dispensed: [], complaint,
      impression: impression.trim() || undefined, allergies: allergies.trim() || undefined,
      designation: ((DESIGNATIONS as readonly string[]).includes(own) ? own : "Dr") as MedicalPayload["designation"],
      prescription: rx.length ? rx : undefined, tests_requested: allTests.length ? allTests : undefined,
      minor_surgery: surgery === "no" ? undefined : surgery,
      minor_surgery_note: surgery !== "no" ? surgeryNote.trim() || undefined : undefined,
      referral: referred ? referral : undefined, refer_to_station_ids: referTo,
    }));
    const data = medicalDataSchema.parse(cleanData({
      tests: [], items: [], referred, referral_urgency: referred ? referral.urgency : undefined,
      refer_to_station_ids: rx.length && pharmacy ? [pharmacy.id] : [],
    }));
    const flags = allergies.trim() ? [{ kind: "allergy", scope: "medical" as const, text: `Allergy: ${allergies.trim().slice(0, 180)}` }] : [];
    onSubmit({ summary: medicalSummary(data), data, confidential: { kind: "medical", payload }, flags });
  };

  return (
    <form onSubmit={submit} onKeyDown={blockEnter} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Only the medical team can see what you write here.</p>
        <MedicalRecord confidential={confidential} records={records ?? []} stations={stations} title="Vital signs and medical record" />

        <Step title="Comments and observations" {...section("comments")} done={!!impression || complaint.length > 0}>
          <ChipGroup label="Presenting complaint">{MEDICAL_COMPLAINTS.map((c) => <Chip key={c} selected={complaint.includes(c)} onToggle={() => toggle(complaint, setComplaint, c)}>{c}</Chip>)}</ChipGroup>
          <Textarea value={impression} onChange={(e) => setImpression(e.target.value)} maxLength={2000} placeholder="Comments or observations" aria-label="Comments and observations" />
          <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Allergies (creates a medical-only alert)</span>
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} maxLength={300} placeholder="e.g. Penicillin" /></label>
        </Step>

        <Step title="Prescription" {...section("rx")} done={rx.length > 0}>
          {drugs && <PrescriptionEditor drugs={drugs} lines={rx} onChange={setRx} />}
        </Step>

        <Step title="Request tests" {...section("tests")} done={tests.length > 0}>
          <ChipGroup label="Tests to request">{[...MEDICAL_TESTS, ...tests.filter((t) => !(MEDICAL_TESTS as readonly string[]).includes(t))].map((t) => <Chip key={t} selected={tests.includes(t)} onToggle={() => toggle(tests, setTests, t)}>{t}</Chip>)}</ChipGroup>
          <div className="flex gap-2">
            <Input aria-label="Another test" placeholder="Another test…" maxLength={60} value={otherTest} onChange={(e) => setOtherTest(e.target.value)} />
            <Button type="button" variant="secondary" disabled={!otherTest.trim()} onClick={addOther}>Add</Button>
          </div>
          <p className="text-caption text-neutral-700">{lab ? `Saving sends them to ${lab.name}. Results come back to your queue.` : "The Laboratory is not switched on. Ask the coordinator."}</p>
        </Step>

        <Step title="Refer" {...section("refer")} done={toOptician || surgery !== "no" || referred}>
          {optician && <Toggle label={`Refer to ${optician.name}`} checked={toOptician} onChange={setToOptician} />}
          <div className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-forest">Minor surgery</span>
            <Segmented label="Minor surgery" value={surgery} onChange={setSurgery} options={[{ value: "no", label: "Not needed" }, { value: "needed", label: "Needed" }, { value: "done", label: "Done" }]} />
          </div>
          {surgery !== "no" && <Input aria-label="Minor surgery note" placeholder="Note (optional)" maxLength={500} value={surgeryNote} onChange={(e) => setSurgeryNote(e.target.value)} />}
          <Toggle label="Refer to hospital" checked={referred} onChange={setReferred} />
          {referred && (
            <>
              <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Facility</span><Input value={referral.facility} maxLength={120} onChange={(e) => setReferral({ ...referral, facility: e.target.value })} placeholder="e.g. Nyanya General Hospital" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Reason</span><Textarea value={referral.reason} maxLength={500} onChange={(e) => setReferral({ ...referral, reason: e.target.value })} className="min-h-20" /></label>
              <Segmented label="Urgency" value={referral.urgency} onChange={(u) => setReferral({ ...referral, urgency: u })} options={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent", tone: "danger" }]} />
            </>
          )}
        </Step>
      </div>
      <SaveBar saving={saving} disabled={referred && (!referral.facility.trim() || !referral.reason.trim())} label="Save medical check"
        hint={referred && (!referral.facility.trim() || !referral.reason.trim()) ? "Add the hospital and the reason" : undefined} />
    </form>
  );
}
