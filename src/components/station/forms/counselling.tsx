"use client";
import { useEffect, useState } from "react";
import { Lock, OctagonAlert } from "lucide-react";
import { counsellingDataSchema, counsellingPayloadSchema, COUNSELLING_CATEGORIES, type CounsellingData } from "@/lib/schemas/service";
import { counsellingSummary } from "@/lib/summary";
import { getMeta, setMeta, db } from "@/lib/offline/db";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Toggle, AlertBanner } from "@/components/ui/misc";
import { Input, Textarea } from "@/components/ui/input";
import type { FormProps } from "./types";
import { MoreOptions, SaveBar, Section, cleanData } from "./shared";

export function CounsellingForm({ visit, session, stations, saving, onSubmit }: FormProps) {
  const draftKey = `draft:counselling:${visit.id}`;
  const [category, setCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [risk, setRisk] = useState<CounsellingData["risk"]>("none");
  const [followup, setFollowup] = useState(false);
  const [preferred, setPreferred] = useState("");
  const [referMedical, setReferMedical] = useState(false);
  const [refer, setRefer] = useState<string[]>([]);

  // Local draft (this device only; wiped with the session).
  useEffect(() => { void getMeta<string>(draftKey).then((d) => d && setNotes(d)); }, [draftKey]);
  useEffect(() => {
    const t = setTimeout(() => void setMeta(draftKey, notes), 500);
    return () => clearTimeout(t);
  }, [notes, draftKey]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    const data = counsellingDataSchema.parse(cleanData({ category, followup_needed: followup, risk, refer_medical: referMedical, refer_to_station_ids: refer }));
    const payload = counsellingPayloadSchema.parse(cleanData({ notes, preferred_time: followup && preferred ? preferred : undefined }));
    void db().meta.delete(draftKey);
    onSubmit({ summary: counsellingSummary(), data, confidential: { kind: "counselling", payload } });
  };

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <Section title="Category">
          <ChipGroup label="Category">{COUNSELLING_CATEGORIES.map((c) => <Chip key={c} size="lg" selected={category === c} onToggle={() => setCategory(c)}>{c}</Chip>)}</ChipGroup>
        </Section>
        <Section title="Session notes">
          <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Confidential: only counsellors can read this. Saved as a draft on this phone while you type.</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-40" maxLength={5000} aria-label="Session notes" />
        </Section>
        <Section title="Risk">
          <Segmented label="Risk" value={risk} onChange={setRisk} options={[{ value: "none", label: "None" }, { value: "pastoral", label: "Pastoral" }, { value: "urgent", label: "Urgent", tone: "danger" }]} />
        </Section>
        {risk === "urgent" && <AlertBanner tone="danger"><OctagonAlert className="mr-1 hidden size-4" aria-hidden />Urgent: refer to a professional. The Station Lead and coordinator will be notified when you save.</AlertBanner>}
        <Toggle label="Follow-up needed" checked={followup} onChange={setFollowup} />
        {followup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-forest">Preferred time (optional)</span>
            <Input value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="e.g. Weekday evenings" />
          </label>
        )}
        <Toggle label="Refer to Medical" checked={referMedical} onChange={setReferMedical} />
        <MoreOptions refer={refer} setRefer={setRefer} stations={stations} currentStationId={session.station.id} />
      </div>
      <SaveBar saving={saving} disabled={!category} hint={!category ? "Choose a category" : undefined} />
    </form>
  );
}
