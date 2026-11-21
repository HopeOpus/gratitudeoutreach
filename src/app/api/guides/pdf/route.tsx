import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin, loadEdition, bad } from "@/lib/server/api-auth";
import { GuidesDocument } from "@/lib/pdf/guide";

export const runtime = "nodejs";

/** One-page printable quick guide per enabled station (Phase 7). */
export async function GET(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const edition = await loadEdition(g, new URL(req.url).searchParams.get("edition"));
  if (!edition) return bad("Edition not found", 404);
  const { data: stations } = await g.sb.from("stations").select("name, kind").eq("edition_id", edition.id).eq("enabled", true).order("sort_order");
  const pdf = await renderToBuffer(<GuidesDocument edition={edition.name} stations={stations ?? []} training={edition.is_training} />);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${edition.code_prefix}-quick-guides.pdf"`, "Cache-Control": "no-store" },
  });
}
