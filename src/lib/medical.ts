/** The shared medical record of one visit (confidential kind `medical`). Medical team only. */
import type { LocalConfidential, LocalRecord } from "@/lib/offline/db";
import type { RxLine } from "@/lib/quick-ticks";
import type { Vitals } from "@/lib/vitals";

type Payload = {
  vitals?: Vitals; complaint?: string[]; complaint_text?: string; impression?: string; allergies?: string; notes?: string;
  tests_requested?: string[]; lab_results?: { test: string; result: string; abnormal: boolean }[];
  eye?: { va_right?: string; va_left?: string; findings?: string; outcomes?: string[] };
  minor_surgery?: "needed" | "done"; minor_surgery_note?: string; prescription?: RxLine[];
  referral?: { facility: string; reason: string; urgency: string };
};

/** Medical records of this visit that still count (undone ones are hidden), newest first. */
export function medicalEntries(confidential: LocalConfidential[], records: LocalRecord[]) {
  const live = new Map(records.map((r) => [r.id, r]));
  return confidential
    .filter((c) => c.kind === "medical" && live.has(c.service_record_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((c) => ({ id: c.service_record_id, payload: c.payload as Payload, record: live.get(c.service_record_id)!, at: c.created_at }));
}

/** Tests the doctor asked for that have no result after the request. */
export function outstandingTests(confidential: LocalConfidential[], records: LocalRecord[]): string[] {
  const open = new Set<string>();
  for (const e of medicalEntries(confidential, records).reverse()) {
    e.payload.tests_requested?.forEach((t) => open.add(t));
    e.payload.lab_results?.forEach((r) => open.delete(r.test));
  }
  return [...open];
}
