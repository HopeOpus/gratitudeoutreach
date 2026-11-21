import "server-only";
import { serverClient } from "./server";
import type { Database } from "./types";

export type OrgRole = Database["public"]["Enums"]["org_role"];
export type AdminContext = { userId: string; email: string | null; orgId: string; role: OrgRole; displayName: string };

const RANK: Record<OrgRole, number> = { viewer: 1, followup: 2, coordinator: 3, super_admin: 4 };

export async function getAdmin(): Promise<AdminContext | null> {
  const sb = await serverClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.is_anonymous) return null;
  const { data } = await sb.from("org_members").select("org_id, role, display_name").eq("user_id", user.id);
  if (!data?.length) return null;
  const best = [...data].sort((a, b) => RANK[b.role] - RANK[a.role])[0]!;
  return { userId: user.id, email: user.email ?? null, orgId: best.org_id, role: best.role, displayName: best.display_name ?? user.email ?? "Admin" };
}

export function hasRole(ctx: AdminContext | null, min: OrgRole): ctx is AdminContext {
  return !!ctx && RANK[ctx.role] >= RANK[min];
}

/** For "followup" pages: followup, coordinator, super_admin (not viewer). */
export function canFollowUp(ctx: AdminContext | null): ctx is AdminContext {
  return !!ctx && ctx.role !== "viewer";
}
