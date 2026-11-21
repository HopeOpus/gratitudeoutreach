import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, loadEdition, bad } from "@/lib/server/api-auth";
import { serviceClient } from "@/lib/supabase/service";
import { decryptPin, encryptPin, randomPin } from "@/lib/server/crypto";

/** Reveal station PINs for the setup page / posters (coordinator+). */
export async function GET(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const edition = await loadEdition(g, new URL(req.url).searchParams.get("edition"));
  if (!edition) return bad("Edition not found", 404);
  const { data: stations } = await g.sb.from("stations").select("id").eq("edition_id", edition.id);
  const ids = (stations ?? []).map((s) => s.id);
  const { data: secrets } = await serviceClient().from("station_secrets").select("*").in("station_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const pins = Object.fromEntries((secrets ?? []).map((s) => [s.station_id, {
    join: decryptPin(s.join_pin_enc, edition.is_training), role: decryptPin(s.role_pin_enc, edition.is_training), lead: decryptPin(s.lead_pin_enc, edition.is_training),
  }]));
  return NextResponse.json({ pins }, { headers: { "Cache-Control": "no-store" } });
}

const body = z.object({
  station_id: z.guid(),
  join: z.union([z.literal("random"), z.string().regex(/^\d{6}$/)]).optional(),
  role: z.union([z.literal("random"), z.literal("clear"), z.string().regex(/^\d{6}$/)]).optional(),
  lead: z.union([z.literal("random"), z.literal("clear"), z.string().regex(/^\d{6}$/)]).optional(),
});

/** Rotate / set PINs (FR-1.4). */
export async function POST(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("PINs must be 6 digits");
  const { station_id } = parsed.data;
  const resolve = (v: string | undefined) => (v === "random" ? randomPin() : v === "clear" ? "" : v);
  const join = resolve(parsed.data.join);
  const role = resolve(parsed.data.role);
  const lead = resolve(parsed.data.lead);
  const { error } = await g.sb.rpc("set_station_pins", { p_station: station_id, p_join_pin: join, p_role_pin: role, p_lead_pin: lead });
  if (error) return bad(error.hint || error.message);
  const svc = serviceClient();
  const { data: existing } = await svc.from("station_secrets").select("*").eq("station_id", station_id).maybeSingle();
  const enc = (v: string | undefined, prev: string | null | undefined) => (v === undefined ? prev ?? null : v === "" ? null : encryptPin(v));
  await svc.from("station_secrets").upsert({
    station_id, join_pin_enc: enc(join, existing?.join_pin_enc), role_pin_enc: enc(role, existing?.role_pin_enc), lead_pin_enc: enc(lead, existing?.lead_pin_enc),
  });
  return NextResponse.json({ ok: true, join, role, lead }, { headers: { "Cache-Control": "no-store" } });
}
