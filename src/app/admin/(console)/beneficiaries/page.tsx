"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Merge } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AlertBanner, Badge, Card } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import { ageLabel } from "@/components/station/bits";
import { formatDate, errorMessage } from "@/lib/utils";

type Ben = { id: string; full_name: string; phone_last4: string | null; phone: string | null; gender: string | null; age_range: string | null; community: string | null; created_at: string; visits: { edition_id: string; card_code: string | null }[] };

export default function BeneficiariesPage() {
  const { admin, editions } = useEditionCtx();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "dups">("all");
  const [merge, setMerge] = useState<Ben[] | null>(null);
  const editionName = (id: string) => editions.find((e) => e.id === id)?.code_prefix ?? "?";

  const list = useQuery({
    queryKey: ["beneficiaries", q],
    queryFn: async () => {
      let query = adminClient().from("beneficiaries").select("id, full_name, phone_last4, phone, gender, age_range, community, created_at, visits(edition_id, card_code)")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
      const t = q.trim();
      if (t.length >= 2) {
        const digits = t.replace(/\D/g, "");
        query = digits.length >= 4 ? query.or(`phone_last4.eq.${digits.slice(-4)},full_name.ilike.%${t}%`) : query.ilike("full_name", `%${t}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Ben[];
    },
    enabled: tab === "all",
    refetchInterval: 10_000,
  });

  const dups = useQuery({
    queryKey: ["dup-candidates"],
    queryFn: async () => {
      const all: Ben[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await adminClient().from("beneficiaries").select("id, full_name, phone_last4, phone, gender, age_range, community, created_at, visits(edition_id, card_code)")
          .is("deleted_at", null).range(from, from + 999);
        if (error) throw error;
        all.push(...(data as unknown as Ben[]));
        if (data.length < 1000) break;
      }
      const groups = new Map<string, Ben[]>();
      for (const b of all) {
        const keys = [`n:${b.full_name.trim().toLowerCase().replace(/\s+/g, " ")}|${b.age_range}`, b.phone ? `p:${b.phone}` : null].filter(Boolean) as string[];
        keys.forEach((k) => groups.set(k, [...(groups.get(k) ?? []), b]));
      }
      const seen = new Set<string>();
      return [...groups.values()].filter((g) => g.length > 1).filter((g) => {
        const key = g.map((b) => b.id).sort().join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: tab === "dups",
  });

  if (!atLeast(admin, "coordinator")) return <AlertBanner tone="info">Only coordinators can browse people.</AlertBanner>;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="People" sub="Everyone served across all editions." actions={<Segmented label="View" value={tab} onChange={setTab} options={[{ value: "all", label: "Directory" }, { value: "dups", label: "Possible duplicates" }]} className="w-80" />} />
      {tab === "all" ? (
        <>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-500" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone (last 4)" className="pl-12" aria-label="Search people" />
          </div>
          {list.isLoading ? <LoadingBlock /> : list.error ? <ErrorBlock error={list.error} /> : (
            <Table head={["Name", "Details", "Editions", "First seen"]} empty="No one found.">
              {list.data!.map((b) => (
                <tr key={b.id}>
                  <Td><Link className="font-medium text-leaf-700 underline-offset-2 hover:underline" href={`/admin/beneficiaries/${b.id}`}>{b.full_name}</Link></Td>
                  <Td className="text-neutral-700">{[b.gender, ageLabel(b.age_range), b.community, b.phone_last4 ? `…${b.phone_last4}` : null].filter(Boolean).join(" · ")}</Td>
                  <Td><div className="flex flex-wrap gap-1">{b.visits.map((v) => <Badge key={v.edition_id} className="bg-neutral-50 text-neutral-700">{editionName(v.edition_id)}{v.card_code ? ` · ${v.card_code}` : ""}</Badge>)}</div></Td>
                  <Td>{formatDate(b.created_at)}</Td>
                </tr>
              ))}
            </Table>
          )}
          {list.data?.length === 200 && <p className="text-caption text-neutral-500">Showing the first 200. Search to narrow down.</p>}
        </>
      ) : dups.isLoading ? <LoadingBlock /> : dups.error ? <ErrorBlock error={dups.error} /> : dups.data!.length === 0 ? (
        <AlertBanner tone="success">No likely duplicates found.</AlertBanner>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {dups.data!.map((g) => (
            <Card key={g.map((b) => b.id).join()} className="flex flex-col gap-2 p-4">
              {g.map((b) => <p key={b.id} className="text-body"><span className="font-medium">{b.full_name}</span> <span className="text-neutral-500">· {ageLabel(b.age_range)} · {b.community ?? "—"} · {b.phone_last4 ? `…${b.phone_last4}` : "no phone"} · {b.visits.map((v) => editionName(v.edition_id)).join(", ") || "no visits"}</span></p>)}
              <Button size="sm" variant="secondary" className="self-start" onClick={() => setMerge(g)}><Merge className="size-4" /> Review and merge</Button>
            </Card>
          ))}
        </div>
      )}
      <MergeSheet group={merge} onClose={() => setMerge(null)} onMerged={() => { void dups.refetch(); void list.refetch(); }} />
    </div>
  );
}

function MergeSheet({ group, onClose, onMerged }: { group: Ben[] | null; onClose: () => void; onMerged: () => void }) {
  const [keep, setKeep] = useState<string | null>(null);
  const keepId = keep ?? group?.[0]?.id ?? null;
  const others = useMemo(() => (group ?? []).filter((b) => b.id !== keepId), [group, keepId]);
  const doMerge = async () => {
    for (const o of others) {
      const { error } = await adminClient().rpc("merge_beneficiaries", { p_keep: keepId!, p_merge: o.id });
      if (error) { toast.error(errorMessage(error)); return; }
    }
    toast.saved("Records merged. The change is in the audit log.");
    setKeep(null); onMerged(); onClose();
  };
  return (
    <BottomSheet open={!!group} onOpenChange={(o) => !o && onClose()} title="Merge duplicates" description="Choose the record to keep. Visits from the others move to it; empty fields are filled in.">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Record to keep</legend>
        {(group ?? []).map((b) => (
          <label key={b.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-neutral-100 p-3">
            <input type="radio" name="keep" checked={keepId === b.id} onChange={() => setKeep(b.id)} className="size-5 accent-leaf" />
            <span className="text-body"><span className="font-medium">{b.full_name}</span> · {b.community ?? "—"} · {b.visits.length} visit(s)</span>
          </label>
        ))}
      </fieldset>
      <Button size="lg" block className="mt-4" onClick={() => void doMerge()}>Merge {others.length} into selected</Button>
    </BottomSheet>
  );
}
