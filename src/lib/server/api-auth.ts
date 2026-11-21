import "server-only";
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { getAdmin, hasRole, type AdminContext, type OrgRole } from "@/lib/supabase/admin-auth";

export type Guarded = { ctx: AdminContext; sb: Awaited<ReturnType<typeof serverClient>> };

export async function requireAdmin(min: OrgRole): Promise<Guarded | NextResponse> {
  const ctx = await getAdmin();
  if (!ctx) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!hasRole(ctx, min)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return { ctx, sb: await serverClient() };
}

/** Confirms the edition belongs to the admin's org (RLS-visible). */
export async function loadEdition(g: Guarded, editionId: string | null) {
  if (!editionId) return null;
  const { data } = await g.sb.from("editions").select("*").eq("id", editionId).eq("org_id", g.ctx.orgId).maybeSingle();
  return data;
}

export const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export function appUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}
