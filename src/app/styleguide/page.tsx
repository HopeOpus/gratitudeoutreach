"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Toaster, toast } from "@/components/ui/toast";
import { AppHeader } from "@/components/ui/app-header";
import { SyncIndicator } from "@/components/ui/sync-indicator";
import { Skeleton, EmptyState, AlertBanner, CodeBadge, ConfidentialBadge, Checkbox, Toggle, Card } from "@/components/ui/misc";
import { StationIcon } from "@/components/station/bits";
import { STATION_META, type StationKind } from "@/lib/stations";

const SWATCHES: [string, string[]][] = [
  ["forest", ["bg-forest-50", "bg-forest-100", "bg-forest-300", "bg-forest-500", "bg-forest-900", "bg-forest-950"]],
  ["leaf", ["bg-leaf-50", "bg-leaf-100", "bg-leaf-200", "bg-leaf-400", "bg-leaf-500", "bg-leaf-600", "bg-leaf-700"]],
  ["fresh", ["bg-fresh-50", "bg-fresh-100", "bg-fresh-200", "bg-fresh-400", "bg-fresh-500", "bg-fresh-600", "bg-fresh-700"]],
  ["teal", ["bg-teal-50", "bg-teal-100", "bg-teal-200", "bg-teal-400", "bg-teal-500", "bg-teal-600", "bg-teal-700"]],
  ["neutral", ["bg-neutral-0", "bg-neutral-25", "bg-neutral-50", "bg-neutral-100", "bg-neutral-300", "bg-neutral-500", "bg-neutral-700", "bg-neutral-900"]],
  ["functional", ["bg-warning", "bg-warning-bg", "bg-danger", "bg-danger-bg", "bg-info", "bg-info-bg", "bg-success", "bg-success-bg", "bg-confidential", "bg-confidential-bg"]],
];
const TYPE: [string, string][] = [["text-display font-light", "display 40/48 Light"], ["text-h1 font-medium", "h1 28/36 Medium"], ["text-h2 font-medium", "h2 22/30 Medium"], ["text-h3 font-medium", "h3 18/26 Medium"], ["text-body-lg", "body-lg 17/26 Regular"], ["text-body", "body 15/24 Regular"], ["text-label font-medium", "label 14/20 Medium"], ["text-caption text-neutral-500", "caption 13/18 Regular"], ["text-code font-medium tracking-wider tabular", "GO26-0142"]];

export default function Styleguide() {
  const [chips, setChips] = useState<string[]>(["Health"]);
  const [seg, setSeg] = useState<"none" | "salvation" | "rededication">("none");
  const [qty, setQty] = useState(1);
  const [sheet, setSheet] = useState(false);
  const [check, setCheck] = useState(true);
  const [tog, setTog] = useState(false);
  return (
    <div className="min-h-dvh bg-neutral-25">
      <AppHeader title="Styleguide · Food" right={<SyncIndicator state={{ status: "synced", pending: 0 }} />} />
      <main className="mx-auto flex max-w-5xl flex-col gap-10 p-6">
        <section><h1 className="text-h1 font-medium text-forest">Gratitude Connect design system</h1><p className="text-body text-neutral-700">Tokens from docs/DesignSystem.md. Sora 300/400/500 only.</p></section>
        <section className="flex flex-col gap-3"><h2 className="text-h2 font-medium text-forest">Colours</h2>
          {SWATCHES.map(([name, list]) => (
            <div key={name}><p className="mb-1 text-label font-medium">{name}</p><div className="flex flex-wrap gap-2">{list.map((c) => <div key={c} className="flex flex-col items-center gap-1"><span className={`size-14 rounded-md ring-1 ring-neutral-100 ${c}`} /><span className="text-caption text-neutral-500">{c.replace("bg-", "")}</span></div>)}</div></div>
          ))}
        </section>
        <section className="flex flex-col gap-2"><h2 className="text-h2 font-medium text-forest">Typography</h2>{TYPE.map(([cls, label]) => <p key={label} className={cls}>{label}</p>)}</section>
        <section className="flex flex-col gap-3"><h2 className="text-h2 font-medium text-forest">Stations</h2>
          <div className="flex flex-wrap gap-4">{(Object.keys(STATION_META) as StationKind[]).map((k) => <div key={k} className="flex items-center gap-2"><StationIcon kind={k} />{STATION_META[k].label}</div>)}</div></section>
        <section className="flex flex-col gap-3"><h2 className="text-h2 font-medium text-forest">Buttons</h2>
          <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button loading>Saving</Button><Button disabled>Disabled</Button></div>
          <Button size="lg" block>56 px primary (mobile)</Button>
          <div className="flex gap-2 rounded-lg bg-forest p-3"><Button variant="dark">On dark</Button><Button variant="outlineDark">Outline dark</Button></div></section>
        <section className="grid gap-4 md:grid-cols-2"><h2 className="text-h2 font-medium text-forest md:col-span-2">Inputs</h2>
          <Field label="Full name" htmlFor="sg1" required><Input id="sg1" placeholder="Ada Okafor" /></Field>
          <Field label="Phone" htmlFor="sg2" error="Use a Nigerian number"><Input id="sg2" invalid defaultValue="123" /></Field>
          <Field label="Notes" htmlFor="sg3" className="md:col-span-2"><Textarea id="sg3" /></Field>
          <ChipGroup label="Focus">{["Health", "Family", "Finances"].map((c) => <Chip key={c} selected={chips.includes(c)} onToggle={() => setChips(chips.includes(c) ? chips.filter((x) => x !== c) : [...chips, c])}>{c}</Chip>)}</ChipGroup>
          <Segmented label="Decision" value={seg} onChange={setSeg} options={[{ value: "none", label: "None" }, { value: "salvation", label: "Salvation" }, { value: "rededication", label: "Rededication" }]} />
          <Stepper label="quantity" value={qty} onChange={setQty} />
          <Checkbox id="sg-c" checked={check} onChange={setCheck} label="Agrees to us recording their details" description="Required" required />
          <Toggle label="Wants follow-up" checked={tog} onChange={setTog} /></section>
        <section className="flex flex-col gap-3"><h2 className="text-h2 font-medium text-forest">Feedback</h2>
          <AlertBanner tone="info">Referred here by Counselling at 10:20</AlertBanner><AlertBanner tone="warning">Food packs low (38)</AlertBanner><AlertBanner tone="danger">Urgent counselling: Station Lead notified</AlertBanner><AlertBanner tone="success">Follow-up created</AlertBanner><AlertBanner tone="confidential">Only counsellors can see this</AlertBanner>
          <div className="flex flex-wrap items-center gap-2"><CodeBadge code="GO26-0142" /><ConfidentialBadge />
            {(["synced", "syncing", "offline", "error"] as const).map((s) => <SyncIndicator key={s} state={{ status: s, pending: 12 }} />)}</div>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => toast.saved("Saved · Food for Ada", () => toast.info("Undone"))}>Show toast</Button><Button variant="secondary" onClick={() => setSheet(true)}>Open bottom sheet</Button></div>
          <Card className="p-4"><Skeleton className="mb-2 h-6 w-1/2" /><Skeleton className="h-16" /></Card>
          <EmptyState title="No one pending. Nice work 🙌" body="People who ask for this service appear here." /></section>
      </main>
      <BottomSheet open={sheet} onOpenChange={setSheet} title="Already served" description="Ada was served at 10:31."><Button size="lg" block onClick={() => setSheet(false)}>OK</Button></BottomSheet>
      <Toaster />
    </div>
  );
}
