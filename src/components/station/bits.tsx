"use client";
import { Check, CornerDownRight, Lock, Circle, X, RotateCcw, ChevronRight } from "lucide-react";
import { cn, formatTime, shortName } from "@/lib/utils";
import { stationMeta } from "@/lib/stations";
import type { LocalNeed, LocalRecord, LocalStation, LocalVisit } from "@/lib/offline/db";
import { CodeBadge, ConfidentialBadge, Badge } from "@/components/ui/misc";
import { AGE_RANGES } from "@/lib/constants";

export function StationIcon({ kind, size = "md", className }: { kind: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const m = stationMeta(kind);
  const Icon = m.icon;
  const box = size === "lg" ? "size-14 rounded-lg" : size === "sm" ? "size-8 rounded-sm" : "size-10 rounded-md";
  const ic = size === "lg" ? "size-8" : size === "sm" ? "size-4" : "size-5";
  return (
    <span className={cn("grid shrink-0 place-items-center text-white", m.bg, box, className)} aria-hidden>
      <Icon className={ic} strokeWidth={1.75} />
    </span>
  );
}

export const ageLabel = (a: string | null | undefined) => AGE_RANGES.find((x) => x.value === a)?.label ?? "";
export const genderShort = (g: string | null | undefined) => (g === "female" ? "F" : g === "male" ? "M" : "");

export function metaLine(v: Pick<LocalVisit, "gender" | "age_range" | "community">) {
  return [genderShort(v.gender), ageLabel(v.age_range), v.community].filter(Boolean).join(" · ");
}

export function NeedChip({ need, station }: { need: LocalNeed | undefined; station: LocalStation }) {
  const state = need?.state ?? "pending";
  const base = "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-label font-medium";
  if (state === "served")
    return <span className={cn(base, "border-leaf-100 bg-leaf-50 text-leaf-700")}><Check className="size-4" aria-hidden />{station.name}<span className="text-caption tabular">{formatTime(need?.state_at)}</span><span className="sr-only">served</span></span>;
  if (state === "declined")
    return <span title={need?.declined_reason ?? undefined} className={cn(base, "border-neutral-100 bg-neutral-50 text-neutral-500 line-through")}><X className="size-4" aria-hidden />{station.name}<span className="sr-only">not available{need?.declined_reason ? `: ${need.declined_reason}` : ""}</span></span>;
  if (state === "referred")
    return <span className={cn(base, "border-teal-100 bg-teal-50 text-teal-700")}><CornerDownRight className="size-4" aria-hidden />{station.name}<span className="sr-only">referred</span></span>;
  return <span className={cn(base, "border-neutral-300 bg-white text-neutral-700")}><Circle className="size-3.5" aria-hidden />{station.name}<span className="sr-only">pending</span></span>;
}

export function TimelineItem({ record, station, fresh }: { record: LocalRecord; station: LocalStation | undefined; fresh?: boolean }) {
  const m = stationMeta(station?.kind);
  return (
    <li className={cn("relative flex gap-3 rounded-md py-3 pl-1 pr-2", fresh && "animate-highlight")}>
      <span className={cn("mt-1.5 size-3 shrink-0 rounded-full", m.bg)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-medium text-forest">{station?.name ?? "Station"}</span>
          {record.has_confidential && <ConfidentialBadge />}
          <span className="ml-auto text-caption text-neutral-500 tabular">{formatTime(record.served_at)}</span>
        </div>
        <p className="text-body text-ink">{record.has_confidential && station?.kind === "counselling" ? "Confidential session recorded" : record.summary}</p>
        <p className="text-caption text-neutral-500">by {record.served_by_name}{record._local ? " · saved on this phone" : ""}</p>
      </div>
    </li>
  );
}

export function PersonRow({ visit, right, onClick, sub }: { visit: LocalVisit; right?: React.ReactNode; onClick: () => void; sub?: React.ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-neutral-25 active:bg-neutral-50 cursor-pointer">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-body-lg font-medium text-forest">{visit.full_name}</span>
            {visit.returning && <ReturningBadge />}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-caption text-neutral-500">
            <CodeBadge code={visit.card_code} />
            <span>{metaLine(visit)}</span>
            {sub}
          </div>
        </div>
        {right}
        <ChevronRight className="size-5 shrink-0 text-neutral-300" aria-hidden />
      </button>
    </li>
  );
}

export function ReturningBadge() {
  return <Badge className="bg-teal-50 text-teal-700"><RotateCcw className="size-3.5" aria-hidden />Returning</Badge>;
}

export function LockedNote({ kind }: { kind: "medical" | "counselling" }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-caption text-confidential">
      <Lock className="size-3.5" aria-hidden /> Only {kind === "medical" ? "medical staff" : "counsellors"} can see this
    </p>
  );
}

export { shortName };
