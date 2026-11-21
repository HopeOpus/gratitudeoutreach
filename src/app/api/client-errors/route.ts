import { NextResponse } from "next/server";
import { z } from "zod";

const body = z.object({
  where: z.string().max(60), digest: z.string().max(60).optional(), name: z.string().max(80),
  message: z.string().max(500), stack: z.string().max(1500).optional(), route: z.string().max(120),
  online: z.boolean(), ua: z.string().max(120), at: z.string().max(40),
});

/** Receives scrubbed client errors (see src/lib/monitoring.ts) and writes them to server logs. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 4000) return new NextResponse(null, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  const parsed = body.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  console.error(JSON.stringify({ type: "client_error", ...parsed.data }));
  return new NextResponse(null, { status: 204 });
}
