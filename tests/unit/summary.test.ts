import { describe, expect, it } from "vitest";
import { prayerSummary, counsellingSummary, medicalSummary, foodSummary, clothingSummary } from "@/lib/summary";
import { prayerDataSchema, foodDataSchema, counsellingDataSchema, medicalPayloadSchema } from "@/lib/schemas/service";

describe("timeline summaries never leak confidential content", () => {
  it("prayer: focus + decision, never notes", () => {
    const s = prayerSummary({ focus: ["Health", "Family"], decision: "salvation", wants_followup: false, join_fellowship: false, notes: "private struggles" });
    expect(s).toBe("Health, Family · Salvation");
    expect(s).not.toContain("private");
  });
  it("counselling: always generic", () => expect(counsellingSummary()).toBe("Counselling session"));
  it("medical: no vitals or diagnosis", () => {
    expect(medicalSummary({ referred: false })).toBe("Medical check");
    expect(medicalSummary({ referred: true })).toBe("Medical check · referred");
  });
  it("food and clothing", () => {
    expect(foodSummary({ items: [{ item_id: "a", qty: 1 }] }, { a: "Family pack" })).toBe("Family pack ×1");
    expect(clothingSummary({ items: [{ item_id: "a", qty: 2 }, { item_id: "b", qty: 1 }], for: "child" })).toBe("3 items (child)");
  });
});

describe("shared zod schemas", () => {
  it("accepts a food tick with no stock items set up", () => expect(foodDataSchema.safeParse({ items: [], outcomes: ["food"] }).success).toBe(true));
  it("rejects a food item with zero quantity", () => expect(foodDataSchema.safeParse({ items: [{ item_id: "0190a0b0-0000-7000-8000-000000000001", qty: 0 }] }).success).toBe(false));
  it("rejects an unknown prayer decision", () => expect(prayerDataSchema.safeParse({ focus: [], decision: "maybe", wants_followup: false, join_fellowship: false }).success).toBe(false));
  it("counselling data has no notes field (notes are confidential payload only)", () => {
    const parsed = counsellingDataSchema.parse({ category: "Grief", followup_needed: true, risk: "urgent", refer_medical: false, notes: "x" } as never);
    expect("notes" in parsed).toBe(false);
  });
  it("medical payload validates vitals ranges", () => {
    expect(medicalPayloadSchema.safeParse({ vitals: { bp_sys: 400 }, complaint: [], dispensed: [], designation: "Dr" }).success).toBe(false);
    expect(medicalPayloadSchema.safeParse({ vitals: { bp_sys: 150, bp_dia: 95 }, complaint: ["Headache"], dispensed: [], designation: "Nurse" }).success).toBe(true);
  });
});
