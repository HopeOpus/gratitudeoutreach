import { describe, expect, it } from "vitest";
import { canSeeStation, compulsoryStations, counsellingRecord, counsellingRequired, isCounsellingRecord, missingBefore, nextStop } from "@/lib/journey";
import { spiritualPayloadSchema } from "@/lib/schemas/service";
import { outstandingTests } from "@/lib/medical";
import type { LocalConfidential, LocalNeed, LocalRecord, LocalStation } from "@/lib/offline/db";
import type { StationKind } from "@/lib/stations";

const KINDS: StationKind[] = ["registration", "medical_assistant", "medical", "optician", "laboratory", "prayer", "pharmacy", "clothing", "food"];
const stations: LocalStation[] = KINDS.map((kind, i) => ({ id: kind, edition_id: "e", kind, name: kind, icon: null, color: null, sort_order: i, enabled: true, is_service: kind !== "registration" }));
const rec = (kind: string, data: Record<string, unknown> = {}, id = kind): LocalRecord => ({ id, visit_id: "v", station_id: kind, served_by_name: "x", summary: "", data, has_confidential: false, served_at: "", voided_at: null, updated_at: "" });
const need = (kind: string, state: LocalNeed["state"] = "pending"): LocalNeed => ({ visit_id: "v", station_id: kind, edition_id: "e", state, source: "registration", state_at: "", declined_reason: null, updated_at: "" });
const base = ["medical_assistant", "prayer", "pharmacy"].map((k) => need(k));

describe("patient journey", () => {
  it("everyone goes to Medical Assistant, Counselling and Pharmacy", () => {
    expect(compulsoryStations(stations).map((s) => s.kind)).toEqual(["medical_assistant", "prayer", "pharmacy"]);
  });

  it("walks the sequence in order", () => {
    const needs = [...base, need("medical"), need("food")];
    const step = (records: LocalRecord[], n = needs) => nextStop({ stations, needs: n, records }, "food")?.kind;
    expect(step([])).toBe("medical_assistant");
    const served = (...k: string[]) => needs.map((n) => (k.includes(n.station_id) ? { ...n, state: "served" as const } : n));
    expect(step([rec("medical_assistant")], served("medical_assistant"))).toBe("medical");
    expect(step([rec("medical_assistant")], served("medical_assistant", "medical"))).toBe("prayer");
    const c = [rec("medical_assistant"), rec("prayer", { counselled: true })];
    expect(step(c, served("medical_assistant", "medical", "prayer"))).toBe("pharmacy");
    expect(step([...c, rec("pharmacy")], served("medical_assistant", "medical", "prayer", "pharmacy"))).toBe("food");
    expect(step([...c, rec("pharmacy")], served("medical_assistant", "medical", "prayer", "pharmacy", "food"))).toBeUndefined();
  });

  it("only completed counselling opens Pharmacy", () => {
    expect(counsellingRecord([rec("prayer", { outcomes: ["Prayed for"] })], stations)).toBeNull();
    expect(counsellingRecord([{ ...rec("prayer", { counselled: true }), voided_at: "x" }], stations)).toBeNull();
    expect(counsellingRecord([rec("prayer", { counselled: true })], stations)?.id).toBe("prayer");
    expect(isCounsellingRecord("prayer", { outcomes: ["Prayed for", "Counselled"] })).toBe(true); // saved before the change
    expect(isCounsellingRecord("food", { counselled: true })).toBe(false);
    expect(counsellingRequired(stations.filter((s) => s.kind !== "prayer"))).toBe(false);
  });

  it("declining Counselling does not skip it", () => {
    const needs = [need("medical_assistant", "declined"), need("prayer", "declined"), need("pharmacy")];
    expect(nextStop({ stations, needs, records: [] }, "food")?.kind).toBe("prayer");
  });

  it("food and clothing warn about Pharmacy only", () => {
    expect(missingBefore("food", { stations, needs: base, records: [] }).map((s) => s.kind)).toEqual(["pharmacy"]);
  });

  it("Laboratory and Optician are visible to the medical team only", () => {
    const lab = stations.find((s) => s.kind === "laboratory")!;
    expect(canSeeStation("food", lab)).toBe(false);
    expect(canSeeStation("prayer", lab)).toBe(false);
    expect(canSeeStation("pharmacy", lab)).toBe(true);
  });

  it("lab work list: requested tests minus results", () => {
    const conf = (id: string, at: string, payload: Record<string, unknown>): LocalConfidential => ({ service_record_id: id, visit_id: "v", kind: "medical", payload, created_at: at });
    const rows = [conf("d", "1", { tests_requested: ["PCV", "Genotype"] }), conf("l", "2", { lab_results: [{ test: "PCV", result: "38", abnormal: false }] })];
    expect(outstandingTests(rows, [rec("medical", {}, "d"), rec("laboratory", {}, "l")])).toEqual(["Genotype"]);
    expect(outstandingTests(rows, [rec("laboratory", {}, "l")])).toEqual([]); // the request was undone
  });

  it("spiritual outcomes need one faith option", () => {
    const ok = { faith: "neither", rededicated: false, prayed: true, healing: false, holy_ghost: "not_yet", tongues: false, wants_followup: false, join_fellowship: false, focus: [] };
    expect(spiritualPayloadSchema.safeParse(ok).success).toBe(true);
    expect(spiritualPayloadSchema.safeParse({ ...ok, faith: undefined }).success).toBe(false);
  });
});
