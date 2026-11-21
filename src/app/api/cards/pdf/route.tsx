import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin, loadEdition, bad } from "@/lib/server/api-auth";
import { CardsDocument, type CardLayout } from "@/lib/pdf/cards";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const url = new URL(req.url);
  const edition = await loadEdition(g, url.searchParams.get("edition"));
  if (!edition) return bad("Edition not found", 404);
  const batch = Number(url.searchParams.get("batch"));
  const layout = (["a4-10", "a4-8", "label58"].includes(url.searchParams.get("layout") ?? "") ? url.searchParams.get("layout") : "a4-10") as CardLayout;
  const codes: string[] = [];
  for (let from = 0; ; from += 1000) {
    let q = g.sb.from("cards").select("code").eq("edition_id", edition.id).neq("status", "void").order("code").range(from, from + 999);
    if (batch) q = q.eq("batch_no", batch);
    const { data } = await q;
    codes.push(...(data ?? []).map((c) => c.code));
    if (!data || data.length < 1000) break;
  }
  if (!codes.length) return bad("No cards in this batch", 404);
  const pdf = await renderToBuffer(<CardsDocument codes={codes} edition={edition.name} layout={layout} />);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${edition.code_prefix}-cards${batch ? `-batch${batch}` : ""}.pdf"`, "Cache-Control": "no-store" },
  });
}
