"use client";
import { ScanLine, Search, Keyboard, UserPlus } from "lucide-react";
import type { VolunteerSession } from "@/lib/offline/session";
import { usePending, useRecent, useStationCounts } from "@/lib/offline/hooks";
import { useScan } from "../scan-context";
import { navigate } from "../nav";
import { PersonRow } from "../bits";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { Check } from "lucide-react";
import { formatTime } from "@/lib/utils";

export function HomeView({ session }: { session: VolunteerSession }) {
  const { openScanner, openKeypad, readOnly } = useScan();
  const isReg = session.station.kind === "registration";
  const counts = useStationCounts(session.station.id);
  const pending = usePending(isReg ? null : session.station.id);
  const recent = useRecent(session.station.id, 5);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-wrap gap-2" aria-label="Station counts">
        {!isReg && <Badge className="min-h-9 bg-white px-3 text-label text-forest ring-1 ring-neutral-100">Pending <span className="tabular">{counts.pending}</span></Badge>}
        <Badge className="min-h-9 bg-white px-3 text-label text-forest ring-1 ring-neutral-100">{isReg ? "Registered" : "Served"} <span className="tabular">{counts.served}</span></Badge>
        {counts.avgSeconds != null && <Badge className="min-h-9 bg-white px-3 text-label text-neutral-700 ring-1 ring-neutral-100">Avg {Math.max(1, Math.round(counts.avgSeconds / 60))} min</Badge>}
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => (isReg ? openScanner("register") : openScanner("lookup"))}
          disabled={readOnly && isReg}
          className="grid size-40 place-items-center rounded-full bg-leaf text-white shadow-pop animate-pulse-soft active:bg-leaf-600 disabled:opacity-50 cursor-pointer"
          aria-label={isReg ? "New person: scan blank card" : "Scan card"}
        >
          <span className="flex flex-col items-center gap-1">
            {isReg ? <UserPlus className="size-12" strokeWidth={1.75} /> : <ScanLine className="size-12" strokeWidth={1.75} />}
            <span className="text-body-lg font-medium">{isReg ? "New person" : "Scan card"}</span>
          </span>
        </button>
        {isReg && <p className="text-caption text-neutral-500">Scan a blank Gratitude Card to start</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="lg" block className="justify-start text-neutral-700" onClick={() => navigate("/s/search")}>
          <Search className="size-5 text-forest" /> Search name, phone, code
        </Button>
        <Button variant="secondary" size="lg" block className="justify-start text-neutral-700" onClick={() => openKeypad("lookup")}>
          <Keyboard className="size-5 text-forest" /> Type card code
        </Button>
      </div>

      {!isReg && (
        <section aria-labelledby="pending-h">
          <div className="mb-1 flex items-center justify-between">
            <h2 id="pending-h" className="text-h3 font-medium text-forest">Pending <span className="tabular">({pending?.length ?? 0})</span></h2>
            <button type="button" className="min-h-11 px-2 text-label font-medium text-leaf-700 cursor-pointer" onClick={() => navigate("/s/pending")}>See all</button>
          </div>
          {pending === undefined ? <Skeleton className="h-32" /> : pending.length === 0 ? (
            <EmptyState title="No one pending. Nice work 🙌" className="py-6" />
          ) : (
            <ul className="divide-y divide-neutral-50 rounded-lg border border-neutral-100 bg-white">
              {pending.slice(0, 5).map((v) => (
                <PersonRow key={v.id} visit={v} onClick={() => navigate(`/s/p/${v.id}`)} right={<span className="text-caption text-neutral-500 tabular">{formatTime(v.registered_at)}</span>} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-1 text-h3 font-medium text-forest">Recent</h2>
        {recent === undefined ? <Skeleton className="h-24" /> : recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-100 px-4 py-6 text-center text-body text-neutral-500">People you serve will show here.</p>
        ) : (
          <ul className="divide-y divide-neutral-50 rounded-lg border border-neutral-100 bg-white">
            {recent.map((v) => (
              <PersonRow key={v.record.id} visit={v} onClick={() => navigate(`/s/p/${v.id}`)}
                right={<span className="inline-flex items-center gap-1 text-caption text-leaf-700 tabular"><Check className="size-4" aria-hidden />{formatTime(v.record.served_at)}</span>} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
