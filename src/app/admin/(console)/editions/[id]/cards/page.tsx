"use client";
import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Plus } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock, KpiTile, ReadOnlyNotice } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";

type Row = { batch_no: number; status: string; code: string };

export default function CardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { editions } = useEditionCtx();
  const edition = editions.find((e) => e.id === id);
  const [count, setCount] = useState(1500);
  const [layout, setLayout] = useState("a4-10");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["cards", id],
    queryFn: async () => {
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await adminClient().from("cards").select("batch_no, status, code").eq("edition_id", id).order("code").range(from, from + 999);
        if (error) throw error;
        rows.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      return rows;
    },
  });
  const batches = useMemo(() => {
    const m = new Map<number, { batch: number; total: number; assigned: number; void: number; first: string; last: string }>();
    (q.data ?? []).forEach((c) => {
      const b = m.get(c.batch_no) ?? { batch: c.batch_no, total: 0, assigned: 0, void: 0, first: c.code, last: c.code };
      b.total++; if (c.status === "assigned") b.assigned++; if (c.status === "void") b.void++;
      if (c.code < b.first) b.first = c.code; if (c.code > b.last) b.last = c.code;
      m.set(c.batch_no, b);
    });
    return [...m.values()].sort((a, b) => a.batch - b.batch);
  }, [q.data]);

  const generate = async () => {
    setBusy(true);
    const r = await fetch("/api/cards/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ edition_id: id, count }) });
    const b = await r.json();
    setBusy(false);
    if (!r.ok) { toast.error(b.error ?? "Could not generate"); return; }
    toast.saved(`Batch ${b.batch_no}: ${b.first} – ${b.last}`);
    void q.refetch();
  };

  if (!edition) return <LoadingBlock />;
  const total = q.data?.length ?? 0;
  const assigned = q.data?.filter((c) => c.status === "assigned").length ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Gratitude Cards" sub={`${edition.name} · codes like ${edition.code_prefix}-0142. QR codes hold only the card code.`} />
      <ReadOnlyNotice closed={edition.status === "closed"} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Cards printed" value={formatNumber(total)} />
        <KpiTile label="Assigned" value={formatNumber(assigned)} />
        <KpiTile label="Unassigned" value={formatNumber(total - assigned - (q.data?.filter((c) => c.status === "void").length ?? 0))} />
        <KpiTile label="Voided" value={formatNumber(q.data?.filter((c) => c.status === "void").length ?? 0)} />
      </div>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <Field label="Cards in new batch" htmlFor="count" hint="Print 30% more than expected turnout"><Input id="count" type="number" min={1} max={5000} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-40" /></Field>
        <Button onClick={() => void generate()} loading={busy} disabled={edition.status === "closed" || count < 1 || count > 5000}><Plus className="size-4" /> Generate batch</Button>
        <div className="ml-auto">
          <Field label="Print layout" htmlFor="layout">
            <Select id="layout" value={layout} onChange={(e) => setLayout(e.target.value)} className="w-64">
              <option value="a4-10">A4 · 10 per page (85 × 55 mm, crop marks)</option>
              <option value="a4-8">A4 · 8 per page (with gaps)</option>
              <option value="label58">58 mm thermal sticker labels</option>
            </Select>
          </Field>
        </div>
      </Card>
      {q.isLoading ? <LoadingBlock /> : q.error ? <ErrorBlock error={q.error} /> : (
        <Table head={["Batch", "Codes", "Cards", "Assigned", "Void", ""]} empty="No cards yet. Generate a batch above.">
          {batches.map((b) => (
            <tr key={b.batch}>
              <Td className="font-medium">#{b.batch}</Td>
              <Td className="tabular">{b.first} – {b.last}</Td>
              <Td className="tabular">{formatNumber(b.total)}</Td>
              <Td className="tabular">{formatNumber(b.assigned)}</Td>
              <Td className="tabular">{formatNumber(b.void)}</Td>
              <Td className="text-right"><Button size="sm" variant="secondary" asChild><a href={`/api/cards/pdf?edition=${id}&batch=${b.batch}&layout=${layout}`} target="_blank" rel="noopener"><FileDown className="size-4" /> Print PDF</a></Button></Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-caption text-neutral-500">Print at 100% scale (turn off “fit to page”). Test-scan a printed card with a phone before printing the full batch.</p>
    </div>
  );
}
