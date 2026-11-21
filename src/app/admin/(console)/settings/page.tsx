"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { adminClient } from "@/lib/supabase/browser";
import { useEditionCtx, atLeast } from "@/components/admin/edition-context";
import { PageHeader, Table, Td, LoadingBlock, ErrorBlock } from "@/components/admin/ui";
import { Card, AlertBanner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field, Select } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/utils";

const ROLES = [["super_admin", "Super Admin"], ["coordinator", "Coordinator"], ["followup", "Follow-up team"], ["viewer", "Viewer"]] as const;

export default function SettingsPage() {
  const { admin } = useEditionCtx();
  const [addOpen, setAddOpen] = useState(false);
  const org = useQuery({
    queryKey: ["org", admin.orgId],
    queryFn: async () => {
      const { data, error } = await adminClient().from("organizations").select("*").eq("id", admin.orgId).single();
      if (error) throw error;
      return data;
    },
  });
  const members = useQuery({
    queryKey: ["members", admin.orgId],
    queryFn: async () => (await adminClient().from("org_members").select("user_id, role, display_name, created_at").eq("org_id", admin.orgId).order("created_at")).data ?? [],
  });
  const [form, setForm] = useState({ name: "", church_name: "", consent_text: "", retention_months: 24 });
  useEffect(() => { if (org.data) setForm({ name: org.data.name, church_name: org.data.church_name ?? "", consent_text: org.data.consent_text, retention_months: org.data.retention_months }); }, [org.data]);

  const save = async () => {
    const consentChanged = org.data && form.consent_text.trim() !== org.data.consent_text;
    const { error } = await adminClient().from("organizations").update({
      name: form.name.trim(), church_name: form.church_name.trim() || null, consent_text: form.consent_text.trim(), retention_months: form.retention_months,
      ...(consentChanged ? { consent_version: org.data!.consent_version + 1 } : {}),
    }).eq("id", admin.orgId);
    if (error) toast.error(errorMessage(error)); else { toast.saved(consentChanged ? "Saved. Consent script is now a new version." : "Saved"); void org.refetch(); }
  };
  const setRole = async (userId: string, role: string) => {
    const { error } = await adminClient().from("org_members").update({ role: role as never }).eq("org_id", admin.orgId).eq("user_id", userId);
    if (error) toast.error(errorMessage(error)); else void members.refetch();
  };
  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the admin console?`)) return;
    const { error } = await adminClient().from("org_members").delete().eq("org_id", admin.orgId).eq("user_id", userId);
    if (error) toast.error(errorMessage(error)); else void members.refetch();
  };

  if (!atLeast(admin, "super_admin")) return <AlertBanner tone="info">Settings are for Super Admins.</AlertBanner>;
  if (org.isLoading) return <LoadingBlock />;
  if (org.error) return <ErrorBlock error={org.error} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-h3 font-medium text-forest">Organisation and consent</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Organisation" htmlFor="o-name"><Input id="o-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Church" htmlFor="o-church"><Input id="o-church" value={form.church_name} onChange={(e) => setForm({ ...form, church_name: e.target.value })} /></Field>
        </div>
        <Field label={`Consent script (read aloud at registration) · version ${org.data!.consent_version}`} htmlFor="o-consent" hint="NDPA 2023: say what is collected, why, who sees it and how long it is kept. Editing creates a new version.">
          <Textarea id="o-consent" value={form.consent_text} onChange={(e) => setForm({ ...form, consent_text: e.target.value })} className="min-h-40" />
        </Field>
        <Field label="Keep confidential notes for (months after the edition closes)" htmlFor="o-ret">
          <Input id="o-ret" type="number" min={1} max={120} value={form.retention_months} onChange={(e) => setForm({ ...form, retention_months: Number(e.target.value) })} className="w-32" />
        </Field>
        <Button className="self-start" onClick={() => void save()}>Save settings</Button>
      </Card>
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-h3 font-medium text-forest">Admins and roles</h2><Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="size-4" /> Add admin</Button></div>
        <Table head={["Name", "Role", ""]}>
          {(members.data ?? []).map((m) => (
            <tr key={m.user_id}>
              <Td className="font-medium">{m.display_name ?? "Admin"}</Td>
              <Td><Select aria-label={`Role for ${m.display_name}`} value={m.role} disabled={m.user_id === admin.userId} onChange={(e) => void setRole(m.user_id, e.target.value)} className="h-10 w-48">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Td>
              <Td className="text-right">{m.user_id !== admin.userId && <Button size="sm" variant="ghost" onClick={() => void remove(m.user_id, m.display_name ?? "this admin")}>Remove</Button>}</Td>
            </tr>
          ))}
        </Table>
        <p className="mt-2 text-caption text-neutral-500">Super Admins and Coordinators never see medical or counselling notes unless they use audited break-glass.</p>
      </section>
      <AddAdminSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => void members.refetch()} />
    </div>
  );
}

function AddAdminSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ email: "", display_name: "", role: "coordinator", password: "" });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    const r = await fetch("/api/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const b = await r.json();
    setBusy(false);
    if (!r.ok) { toast.error(b.error ?? "Could not add"); return; }
    toast.saved(b.invited ? "Invitation email sent" : "Admin added");
    setF({ email: "", display_name: "", role: "coordinator", password: "" }); onAdded(); onClose();
  };
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title="Add admin" description="Leave the password empty to send an email invitation instead.">
      <div className="flex flex-col gap-3">
        <Field label="Email" htmlFor="a-email"><Input id="a-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Name" htmlFor="a-name"><Input id="a-name" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
        <Field label="Role" htmlFor="a-role"><Select id="a-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Temporary password (optional, 10+ characters)" htmlFor="a-pw"><Input id="a-pw" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Button size="lg" block loading={busy} disabled={!f.email.includes("@") || !f.display_name.trim()} onClick={() => void add()}>Add admin</Button>
      </div>
    </BottomSheet>
  );
}
