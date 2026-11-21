"use client";
import type { VolunteerSession } from "@/lib/offline/session";
import { usePending, useRecent } from "@/lib/offline/hooks";
import { navigate } from "../nav";
import { PersonRow } from "../bits";
import { EmptyState, Skeleton, Badge } from "@/components/ui/misc";
import { formatTime } from "@/lib/utils";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";

export function PendingView({ session }: { session: VolunteerSession }) {
  const [tab, setTab] = useState<"pending" | "recent">(session.station.kind === "registration" ? "recent" : "pending");
  const pending = usePending(session.station.id);
  const recent = useRecent(session.station.id, 20);
  const rows = tab === "pending" ? pending : recent;
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-h2 font-medium text-forest">{session.station.name} queue</h2>
      <Segmented label="List" value={tab} onChange={setTab} options={[{ value: "pending", label: `Pending (${pending?.length ?? 0})` }, { value: "recent", label: "Recent" }]} />
      {rows === undefined ? <Skeleton className="h-64" /> : rows.length === 0 ? (
        <EmptyState title={tab === "pending" ? "No one pending. Nice work 🙌" : "No one served yet"} body={tab === "pending" ? "People who ask for this service at registration, or are referred here, appear in this list." : undefined} />
      ) : (
        <ul className="divide-y divide-neutral-50 rounded-lg border border-neutral-100 bg-white">
          {tab === "pending"
            ? pending!.map((v) => (
                <PersonRow key={v.id} visit={v} onClick={() => navigate(`/s/p/${v.id}`)}
                  sub={v.need.state === "referred" ? <Badge className="bg-teal-50 text-teal-700">Referred</Badge> : undefined}
                  right={<span className="text-caption text-neutral-500 tabular">{formatTime(v.registered_at)}</span>} />
              ))
            : recent!.map((v) => (
                <PersonRow key={v.record.id} visit={v} onClick={() => navigate(`/s/p/${v.id}`)} right={<span className="text-caption text-leaf-700 tabular">{formatTime(v.record.served_at)}</span>} />
              ))}
        </ul>
      )}
    </div>
  );
}
