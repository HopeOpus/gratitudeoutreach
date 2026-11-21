"use client";
import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { prayerDataSchema, PRAYER_FOCUS, type PrayerData } from "@/lib/schemas/service";
import { prayerSummary } from "@/lib/summary";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Toggle, AlertBanner } from "@/components/ui/misc";
import type { FormProps } from "./types";
import { MoreOptions, SaveBar, Section, cleanData } from "./shared";

export function PrayerForm({ visit, session, stations, saving, onSubmit }: FormProps) {
  const [focus, setFocus] = useState<string[]>([]);
  const [decision, setDecision] = useState<PrayerData["decision"]>("none");
  const [wantsFollowup, setWantsFollowup] = useState(false);
  const [fellowship, setFellowship] = useState(false);
  const [notes, setNotes] = useState("");
  const [refer, setRefer] = useState<string[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = prayerDataSchema.parse(cleanData({ focus, decision, wants_followup: wantsFollowup, join_fellowship: fellowship, notes: notes || undefined, refer_to_station_ids: refer }));
    onSubmit({ summary: prayerSummary(parsed), data: parsed });
  };
  const toggle = (f: string) => setFocus((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <Section title="Prayer focus">
          <ChipGroup label="Prayer focus">{PRAYER_FOCUS.map((f) => <Chip key={f} size="lg" selected={focus.includes(f)} onToggle={() => toggle(f)}>{f}</Chip>)}</ChipGroup>
        </Section>
        <Section title="Decision">
          <Segmented label="Decision" value={decision} onChange={setDecision} options={[{ value: "none", label: "None" }, { value: "salvation", label: "Salvation" }, { value: "rededication", label: "Rededication" }]} />
        </Section>
        {decision !== "none" && (
          <AlertBanner tone="success"><PartyPopper className="mr-1 inline size-4" aria-hidden />Praise God! Saving creates a follow-up for {visit.full_name.split(" ")[0]}{visit.consent_followup ? "." : " (no follow-up contact consent: the team will see the name only)."}</AlertBanner>
        )}
        <div className="flex flex-col gap-2">
          <Toggle label="Wants follow-up" checked={wantsFollowup} onChange={setWantsFollowup} />
          <Toggle label="Wants to join a fellowship" checked={fellowship} onChange={setFellowship} />
        </div>
        <MoreOptions notes={notes} setNotes={setNotes} refer={refer} setRefer={setRefer} stations={stations} currentStationId={session.station.id} notesLabel="Notes (not shown on the timeline)" />
      </div>
      <SaveBar saving={saving} disabled={focus.length === 0 && decision === "none"} hint={focus.length === 0 && decision === "none" ? "Choose a focus or decision" : undefined} />
    </form>
  );
}
