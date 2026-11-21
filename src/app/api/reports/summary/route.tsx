import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin, loadEdition, bad } from "@/lib/server/api-auth";
import { ReportDocument } from "@/lib/pdf/report";
import type { DashboardStats } from "@/lib/dashboard";

export const runtime = "nodejs";

/** Branded edition summary (FR-11.1). Viewer+ (aggregates only). */
export async function GET(req: Request) {
  const g = await requireAdmin("viewer");
  if (g instanceof NextResponse) return g;
  const edition = await loadEdition(g, new URL(req.url).searchParams.get("edition"));
  if (!edition) return bad("Edition not found", 404);
  const { data, error } = await g.sb.rpc("dashboard_stats", { p_edition: edition.id });
  if (error || !data) return bad(error?.message ?? "No data", 500);
  const { data: org } = await g.sb.from("organizations").select("name").eq("id", edition.org_id).maybeSingle();
  const pdf = await renderToBuffer(<ReportDocument edition={edition} stats={data as unknown as DashboardStats} org={org?.name ?? "Gratitude Outreach"} />);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${edition.code_prefix}-summary.pdf"`, "Cache-Control": "no-store" },
  });
}
