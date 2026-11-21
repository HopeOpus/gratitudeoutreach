import type { Metadata } from "next";
import { getAdmin } from "@/lib/supabase/admin-auth";
import { AdminShell } from "@/components/admin/shell";
import { NoAccess } from "@/components/admin/no-access";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <NoAccess />;
  return <AdminShell admin={{ role: admin.role, displayName: admin.displayName, orgId: admin.orgId, userId: admin.userId }}>{children}</AdminShell>;
}
