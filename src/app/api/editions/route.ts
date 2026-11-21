import { NextResponse } from "next/server";
import { requireAdmin, bad } from "@/lib/server/api-auth";
import { editionSchema } from "@/lib/schemas/join";
import { serviceClient } from "@/lib/supabase/service";
import { encryptPin, randomPin } from "@/lib/server/crypto";

/** Create (or clone) an edition, then give every station a fresh PIN the coordinator can print. */
export async function POST(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const parsed = editionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid edition");
  const e = parsed.data;
  const { data: id, error } = await g.sb.rpc("create_edition", {
    p_org: g.ctx.orgId, p_name: e.name, p_code_prefix: e.code_prefix, p_starts_on: e.starts_on, p_ends_on: e.ends_on,
    p_venue: e.venue || undefined, p_clone_from: e.clone_from || undefined, p_is_training: e.is_training ?? false,
  });
  if (error || !id) return bad(error?.message ?? "Could not create edition");
  await rotateAllPins(g.sb, id as string);
  return NextResponse.json({ id });
}

async function rotateAllPins(sb: Awaited<ReturnType<typeof import("@/lib/supabase/server").serverClient>>, editionId: string) {
  const { data: stations } = await sb.from("stations").select("id, kind").eq("edition_id", editionId);
  const svc = serviceClient();
  for (const s of stations ?? []) {
    const join = randomPin();
    const role = s.kind === "medical" || s.kind === "counselling" ? randomPin() : null;
    const lead = randomPin();
    const { error } = await sb.rpc("set_station_pins", { p_station: s.id, p_join_pin: join, p_role_pin: role ?? undefined, p_lead_pin: lead });
    if (error) continue; // rare PIN collision: coordinator can rotate again
    await svc.from("station_secrets").upsert({ station_id: s.id, join_pin_enc: encryptPin(join), role_pin_enc: role ? encryptPin(role) : null, lead_pin_enc: encryptPin(lead) });
  }
}
