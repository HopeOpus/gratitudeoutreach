import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";

/** Vercel cron: redact confidential payloads past the retention period (FR-14.3). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { data, error } = await serviceClient().rpc("redact_expired_confidential");
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ redacted: data });
}
