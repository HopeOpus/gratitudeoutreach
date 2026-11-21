import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, bad, appUrl } from "@/lib/server/api-auth";
import { serviceClient } from "@/lib/supabase/service";
import { newJoinToken } from "@/lib/server/crypto";

const body = z.object({ station_id: z.guid(), days: z.number().int().min(1).max(30).default(3) });

/** Signed, expiring join link for a station (no PIN in the URL). */
export async function POST(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid request");
  const { data: station } = await g.sb.from("stations").select("id").eq("id", parsed.data.station_id).maybeSingle();
  if (!station) return bad("Station not found", 404);
  const { token, hash } = newJoinToken();
  const expires = new Date(Date.now() + parsed.data.days * 86400_000).toISOString();
  const { error } = await serviceClient().from("station_join_tokens").insert({ token_hash: hash, station_id: station.id, expires_at: expires, created_by: g.ctx.userId });
  if (error) return bad(error.message, 500);
  return NextResponse.json({ url: `${appUrl(req)}/join/${token}`, expires_at: expires }, { headers: { "Cache-Control": "no-store" } });
}
