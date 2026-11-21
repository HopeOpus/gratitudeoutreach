"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock } from "@/components/admin/ui";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertBanner, Badge } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";

const ACTIONS = ["", "insert", "update", "delete", "export", "break_glass", "confidential_view", "merge", "pin_rotate", "close_edition", "revoke_session", "move_session", "patch_rejected"];

export default function AuditPage() {
  const { admin } = useEditionCtx();
  const [action, setAction] = useState("");
  const [table, setTable] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["audit", action, table, page],
    queryFn: async () => {
      let query = adminClient().from("audit_log").select("id, at, actor_user, actor_session, action, table_name, row_id, meta, before, after").order("at", { ascending: false }).range(page * 100, page * 100 + 99);
      if (action) query = query.eq("action", action);
      if (table) query = query.eq("table_name", table);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  if (!atLeast(admin, "super_admin")) return <AlertBanner tone="info">The audit log is visible to Super Admins only.</AlertBanner>;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Audit log" sub="Every create, edit, export, merge and confidential access." />
      <div className="flex flex-wrap gap-3">
        <Select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} className="w-56">{ACTIONS.map((a) => <option key={a} value={a}>{a || "All actions"}</option>)}</Select>
        <Select aria-label="Table" value={table} onChange={(e) => { setTable(e.target.value); setPage(0); }} className="w-56">
          {["", "beneficiaries", "visits", "service_records", "confidential_records", "cards", "editions", "stations", "inventory_items", "followups", "org_members", "volunteer_sessions"].map((t) => <option key={t} value={t}>{t || "All tables"}</option>)}
        </Select>
      </div>
      {q.isLoading ? <LoadingBlock /> : q.error ? <ErrorBlock error={q.error} /> : (
        <Table head={["When", "Action", "Table", "Who", "Details"]}>
          {q.data!.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-caption">{formatDateTime(r.at)}</Td>
              <Td><Badge className={["break_glass", "confidential_view", "export", "merge"].includes(r.action) ? "bg-warning-bg text-warning" : "bg-neutral-50 text-neutral-700"}>{r.action}</Badge></Td>
              <Td className="text-caption">{r.table_name}</Td>
              <Td className="text-caption">{r.actor_session ? "Volunteer session" : r.actor_user ? "Admin" : "System"}<br /><span className="text-neutral-500">{(r.actor_session ?? r.actor_user ?? "").slice(0, 8)}</span></Td>
              <Td className="max-w-md">
                <details><summary className="cursor-pointer text-caption text-leaf-700">View</summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-neutral-25 p-2 text-caption">{JSON.stringify({ meta: r.meta, before: r.before, after: r.after }, null, 1)}</pre>
                </details>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button>
        <Button variant="secondary" disabled={(q.data?.length ?? 0) < 100} onClick={() => setPage(page + 1)}>Older</Button>
      </div>
    </div>
  );
}
