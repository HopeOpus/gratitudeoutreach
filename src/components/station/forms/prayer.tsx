"use client";
import { useState } from "react";
import { Lock, PartyPopper } from "lucide-react";
import { spiritualPayloadSchema, PRAYER_FOCUS, type SpiritualPayload } from "@/lib/schemas/service";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { AlertBanner, Checkbox } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/input";
import { firstName } from "@/lib/utils";
import type { FormProps } from "./types";
import { SaveBar, Section, cleanData } from "./shared";

const FAITH_OPTIONS: { value: SpiritualPayload["faith"]; label: string; hint: string }[] = [
  { value: "new_convert", label: "New Convert", hint: "Accepted Christ here today" },
  { value: "born_again", label: "Already Born Again", hint: "Was a Christian before today" },
  { value: "neither", label: "Neither", hint: "Did not make a decision" },
];

/** Counselling (station kind `prayer`). Saving completes Counselling and opens Pharmacy. */
export function PrayerForm({ visit, saving, onSubmit }: FormProps) {
  const [faith, setFaith] = useState<SpiritualPayload["faith"] | null>(null);
  const [holyGhost, setHolyGhost] = useState<SpiritualPayload["holy_ghost"]>("not_yet");
  const [t, setT] = useState({ prayed: true, healing: false, tongues: false, rededicated: false, wants_followup: false, join_fellowship: false });
  const [focus, setFocus] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const tick = (k: keyof typeof t) => (on: boolean) => setT((x) => ({ ...x, [k]: on }));
  const name = firstName(visit.full_name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faith) return;
    const payload = spiritualPayloadSchema.parse(cleanData({
      faith, holy_ghost: holyGhost, ...t, rededicated: faith !== "new_convert" && t.rededicated, focus, notes: notes.trim() || undefined,
    }));
    onSubmit({ summary: "Counselling completed", data: { counselled: true }, confidential: { kind: "spiritual", payload } });
  };

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <p className="inline-flex items-center gap-1 text-caption text-confidential"><Lock className="size-3.5" aria-hidden /> Other stations only see “Counselling completed”.</p>
        <Section title="Faith">
          <div role="radiogroup" aria-label="Faith" className="flex flex-col gap-2">
            {FAITH_OPTIONS.map((o) => (
              <label key={o.value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-2 bg-white px-4 py-2 ${faith === o.value ? "border-leaf bg-leaf-50" : "border-neutral-100"}`}>
                <input type="radio" name="faith" className="size-6 shrink-0 accent-leaf" checked={faith === o.value} onChange={() => setFaith(o.value)} />
                <span><span className="block text-body-lg font-medium text-forest">{o.label}</span><span className="block text-caption text-neutral-700">{o.hint}</span></span>
              </label>
            ))}
          </div>
          {faith && faith !== "new_convert" && <Checkbox id="c-reded" checked={t.rededicated} onChange={tick("rededicated")} label="Rededicated their life" />}
        </Section>
        {faith === "new_convert" && (
          <AlertBanner tone="success"><PartyPopper className="mr-1 inline size-4" aria-hidden />Praise God! Saving creates a follow-up for {name}{visit.consent_followup ? "." : " (no follow-up contact consent: the team will see the name only)."}</AlertBanner>
        )}
        <Section title="Baptism of the Holy Ghost">
          <Segmented label="Baptism of the Holy Ghost" value={holyGhost} onChange={setHolyGhost}
            options={[{ value: "not_yet", label: "Not yet" }, { value: "already", label: "Already" }, { value: "today", label: "New, today" }]} />
          <Checkbox id="c-tongues" checked={t.tongues} onChange={tick("tongues")} label="Already speaks in tongues" />
        </Section>
        <Section title="What happened">
          <Checkbox id="c-prayed" checked={t.prayed} onChange={tick("prayed")} label="Has been prayed for" />
          <Checkbox id="c-healing" checked={t.healing} onChange={tick("healing")} label="Received healing" />
          <Checkbox id="c-follow" checked={t.wants_followup} onChange={tick("wants_followup")} label="Wants a follow-up visit or call" />
          <Checkbox id="c-fellow" checked={t.join_fellowship} onChange={tick("join_fellowship")} label="Wants to join a fellowship" />
        </Section>
        <Section title="Prayer focus (optional)">
          <ChipGroup label="Prayer focus">{PRAYER_FOCUS.map((f) => <Chip key={f} selected={focus.includes(f)} onToggle={() => setFocus(focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f])}>{f}</Chip>)}</ChipGroup>
        </Section>
        <label className="flex flex-col gap-1.5"><span className="text-label font-medium text-forest">Notes (optional)</span><Textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} className="min-h-20" /></label>
      </div>
      <SaveBar saving={saving} disabled={!faith} label="Complete Counselling" hint={!faith ? "Choose one option under Faith" : undefined} />
    </form>
  );
}
