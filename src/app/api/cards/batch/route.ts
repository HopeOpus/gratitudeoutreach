import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, bad } from "@/lib/server/api-auth";

const body = z.object({ edition_id: z.guid(), count: z.number().int().min(1).max(5000) });

export async function POST(req: Request) {
  const g = await requireAdmin("coordinator");
  if (g instanceof NextResponse) return g;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Between 1 and 5,000 cards per batch");
  const { data, error } = await g.sb.rpc("generate_cards", { p_edition: parsed.data.edition_id, p_count: parsed.data.count });
  if (error) return bad(error.hint || error.message);
  return NextResponse.json(data);
}
