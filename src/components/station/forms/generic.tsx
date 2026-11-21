"use client";
import { useState } from "react";
import { Textarea } from "@/components/ui/input";
import type { FormProps } from "./types";
import { MoreOptions, SaveBar, Section, cleanData } from "./shared";

/** Checkout / custom stations (custom form builder is P1). */
export function GenericForm({ session, stations, saving, onSubmit }: FormProps) {
  const [notes, setNotes] = useState("");
  const [refer, setRefer] = useState<string[]>([]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ summary: `${session.station.name} service`, data: cleanData({ notes: notes || undefined, refer_to_station_ids: refer }) }); }} className="flex min-h-[calc(100dvh-128px)] flex-col">
      <div className="flex flex-1 flex-col gap-5 p-4">
        <Section title="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Section>
        <MoreOptions refer={refer} setRefer={setRefer} stations={stations} currentStationId={session.station.id} />
      </div>
      <SaveBar saving={saving} />
    </form>
  );
}
