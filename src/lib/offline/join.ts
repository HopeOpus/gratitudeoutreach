"use client";
import { volunteerClient, ensureAnonymousUser } from "@/lib/supabase/volunteer";
import { db, setMeta, purgeLocalData, type LocalStation } from "./db";
import { saveSession, type VolunteerSession } from "./session";
import { normalizePhone } from "@/lib/utils";

export type JoinCheck = { ok: true; station: { id: string; name: string; kind: string }; needsRolePin: boolean } | { ok: false; error: string; retryAfter?: number };

const ERRORS: Record<string, string> = {
  invalid_pin: "That PIN doesn't match a station. Ask your station lead.",
  invalid_token: "This join link has expired. Ask your station lead for the PIN.",
  locked: "Too many tries. Please wait 5 minutes, then try again.",
  invalid_role_pin: "That role PIN is not right. Ask your Station Lead.",
  confidential_ack_required: "Please agree to keep information confidential.",
  name_required: "Enter your first name.",
  invalid_phone: "Use a Nigerian number, e.g. 0803 123 4567.",
  edition_ended: "This event has ended.",
};
export const joinErrorText = (code: string) => ERRORS[code] ?? "Could not join. Check your connection and try again.";

type Cred = { pin?: string; token?: string };

async function call(cred: Cred, extra: Record<string, unknown>) {
  await ensureAnonymousUser();
  const sb = (await volunteerClient());
  const deviceLabel = typeof navigator !== "undefined" ? navigator.userAgent.match(/\(([^;)]+)/)?.[1]?.slice(0, 40) ?? "Phone" : "Phone";
  const base = { p_device_label: deviceLabel, ...extra };
  const res = cred.token
    ? await sb.rpc("join_station_token", { p_token: cred.token, ...base } as never)
    : await sb.rpc("join_station", { p_pin: cred.pin ?? "", ...base } as never);
  if (res.error) throw res.error;
  return res.data as Record<string, unknown>;
}

/** Step 1: check the PIN/token only. */
export async function checkStation(cred: Cred): Promise<JoinCheck> {
  const data = await call(cred, { p_name: null });
  if (data.error) return { ok: false, error: String(data.error), retryAfter: Number(data.retry_after_seconds) || undefined };
  const st = data.station as { id: string; name: string; kind: string };
  return { ok: true, station: st, needsRolePin: Boolean(data.needs_role_pin) };
}

/** Step 2: create the session, then prepare the device. */
export async function completeJoin(cred: Cred, who: { name: string; phone?: string; rolePin?: string; designation?: string; ack?: boolean }) {
  const data = await call(cred, {
    p_name: who.name.trim(),
    p_phone: normalizePhone(who.phone) ?? null,
    p_role_pin: who.rolePin || null,
    p_designation: who.designation || null,
    p_confidential_ack: !!who.ack,
  });
  if (data.error) return { ok: false as const, error: String(data.error), needsRolePin: Boolean(data.needs_role_pin) };

  // Fresh device state for every new session (never mix editions/stations).
  await purgeLocalData();
  const session = data as unknown as VolunteerSession;
  await saveSession(session);
  const sb = (await volunteerClient());
  const { data: stations } = await sb.from("stations_public").select("*").eq("edition_id", session.edition.id).order("sort_order");
  if (stations) await db().stations.bulkPut(stations as unknown as LocalStation[]);
  if (session.station.kind === "registration") {
    const { data: block } = await sb.rpc("reserve_code_block", { p_size: 999 });
    if (block) await setMeta("code_block", block);
  }
  return { ok: true as const, session };
}
