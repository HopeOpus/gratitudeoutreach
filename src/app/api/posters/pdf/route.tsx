import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAdmin, loadEdition, bad, appUrl } from "@/lib/server/api-auth";
import { serviceClient } from "@/lib/supabase/service";
import { decryptPin, newJoinToken } from "@/lib/server/crypto";
import { PostersDocument } from "@/lib/pdf/poster";

export const runtime = "nodejs";

/** Station posters with a fresh signed join-QR (valid until the day after the edition ends). */
export async function GET(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const edition = await loadEdition(g, new URL(req.url).searchParams.get("edition"));
  if (!edition) return bad("Edition not found", 404);
  const { data: stations } = await g.sb.from("stations").select("id, name, kind, enabled, sort_order").eq("edition_id", edition.id).eq("enabled", true).order("sort_order");
  const svc = serviceClient();
  const ids = (stations ?? []).map((s) => s.id);
  const { data: secrets } = await svc.from("station_secrets").select("station_id, join_pin_enc").in("station_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const pinById = new Map((secrets ?? []).map((s) => [s.station_id, decryptPin(s.join_pin_enc, edition.is_training)]));
  const expires = new Date(Math.max(Date.now() + 86400_000, new Date(`${edition.ends_on}T23:59:00+01:00`).getTime() + 86400_000)).toISOString();
  const base = appUrl(req);
  const posterStations = [];
  for (const s of stations ?? []) {
    const { token, hash } = newJoinToken();
    await svc.from("station_join_tokens").insert({ token_hash: hash, station_id: s.id, expires_at: expires, created_by: g.ctx.userId });
    posterStations.push({ name: s.name, kind: s.kind, pin: pinById.get(s.id) ?? null, joinUrl: `${base}/join/${token}`, confidential: s.kind === "medical" || s.kind === "counselling" });
  }
  const pdf = await renderToBuffer(<PostersDocument edition={edition.name} stations={posterStations} training={edition.is_training} />);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${edition.code_prefix}-posters.pdf"`, "Cache-Control": "no-store" },
  });
}
