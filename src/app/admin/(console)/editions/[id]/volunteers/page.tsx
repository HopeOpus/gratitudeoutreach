"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Ban } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import { relativeMinutes, formatTime, errorMessage, cn } from "@/lib/utils";

export default function VolunteersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { editions } = useEditionCtx();
  const edition = editions.find((e) => e.id === id);
  const [filter, setFilter] = useState<"active" | "all" | "registered">("active");
  const [moving, setMoving] = useState<{ id: string; name: string; station_id: string } | null>(null);

  const stations = useQuery({ queryKey: ["stations", id], queryFn: async () => (await adminClient().from("stations_public").select("*").eq("edition_id", id).order("sort_order")).data ?? [] });
  const sessions = useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const { data, error } = await adminClient().from("volunteer_sessions")
        .select("id, account_id, display_name, phone, designation, role, station_id, device_label, last_seen_at, pending_ops, oldest_pending_at, revoked_at, expires_at, created_at")
        .eq("edition_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
  const accounts = useQuery({
    queryKey: ["volunteer-accounts", id],
    queryFn: async () => {
      const { data, error } = await adminClient().from("volunteer_accounts")
        .select("id, display_name, phone, designation, station_id, created_at")
        .eq("edition_id", id).order("display_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
  const stationName = (sid: string) => stations.data?.find((s) => s.id === sid)?.name ?? "—";
  const revoke = async (sid: string, name: string) => {
    if (!window.confirm(`End ${name}'s session? Their phone will clear its data the next time it is online.`)) return;
    const { error } = await adminClient().rpc("revoke_session", { p_session: sid });
    if (error) toast.error(errorMessage(error)); else { toast.saved(`Session ended for ${name}`); void sessions.refetch(); }
  };
  const move = async (to: string) => {
    if (!moving) return;
    const { error } = await adminClient().rpc("move_session", { p_session: moving.id, p_station: to });
    if (error) toast.error(errorMessage(error)); else { toast.saved(`${moving.name} moved to ${stationName(to)}`); setMoving(null); void sessions.refetch(); }
  };

  if (!edition) return <LoadingBlock />;
  const now = Date.now();
  const isActive = (s: { revoked_at: string | null; expires_at: string }) => !s.revoked_at && new Date(s.expires_at).getTime() > now;
  const rows = (sessions.data ?? []).filter((s) => filter === "all" || isActive(s));
  const devicesFor = (accountId: string) => (sessions.data ?? []).filter((s) => s.account_id === accountId && isActive(s)).length;
  return (
    <div>
      <PageHeader title="Volunteers" sub={`${edition.name} · volunteers register once with a station PIN, then sign in with name and phone on any device`} actions={<Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "active", label: "Signed in" }, { value: "all", label: "All devices" }, { value: "registered", label: "Registered" }]} className="w-96" />} />
      {filter === "registered" ? (
        accounts.isLoading ? <LoadingBlock /> : accounts.error ? <ErrorBlock error={accounts.error} /> : (
          <Table head={["Volunteer", "Phone", "Station", "Registered", "Devices signed in"]} empty="No volunteers have registered yet.">
            {(accounts.data ?? []).map((a) => (
              <tr key={a.id}>
                <Td><span className="font-medium text-forest">{a.designation ? `${a.designation} ` : ""}{a.display_name}</span></Td>
                <Td className="tabular">{a.phone}</Td>
                <Td>{stationName(a.station_id)}</Td>
                <Td>{formatTime(a.created_at)}</Td>
                <Td className="tabular">{devicesFor(a.id)}</Td>
              </tr>
            ))}
          </Table>
        )
      ) : sessions.isLoading ? <LoadingBlock /> : sessions.error ? <ErrorBlock error={sessions.error} /> : (
        <Table head={["Volunteer", "Station", "Joined", "Last seen", "Unsynced", ""]} empty="No volunteers signed in yet.">
          {rows.map((s) => {
            const active = !s.revoked_at && new Date(s.expires_at).getTime() > now;
            return (
              <tr key={s.id}>
                <Td><span className="font-medium text-forest">{s.designation ? `${s.designation} ` : ""}{s.display_name}</span>{s.role === "station_lead" && <Badge className="ml-2 bg-leaf-50 text-leaf-700">Lead</Badge>}<br /><span className="text-caption text-neutral-500">{s.phone ?? "No phone"} · {s.device_label ?? "Device"}</span></Td>
                <Td>{stationName(s.station_id)}</Td>
                <Td>{formatTime(s.created_at)}</Td>
                <Td>{active ? relativeMinutes(s.last_seen_at) : <Badge className="bg-neutral-50 text-neutral-700">{s.revoked_at ? "Ended" : "Expired"}</Badge>}</Td>
                <Td className={cn("tabular", s.pending_ops > 0 && "text-warning")}>{s.pending_ops}</Td>
                <Td className="text-right">
                  {active && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setMoving({ id: s.id, name: s.display_name, station_id: s.station_id })}><ArrowRightLeft className="size-4" /> Move</Button>
                      <Button size="sm" variant="ghost" onClick={() => void revoke(s.id, s.display_name)}><Ban className="size-4" /> End</Button>
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      <BottomSheet open={!!moving} onOpenChange={(o) => !o && setMoving(null)} title={`Move ${moving?.name ?? ""}`} description="All their signed-in phones switch station within 30 seconds, and they sign in to the new station from now on. Moving into Medical, Pharmacy or Counselling gives access to confidential notes.">
        <Select aria-label="New station" defaultValue={moving?.station_id} onChange={(e) => void move(e.target.value)}>
          {(stations.data ?? []).map((s) => <option key={s.id} value={s.id!}>{s.name}</option>)}
        </Select>
      </BottomSheet>
    </div>
  );
}
