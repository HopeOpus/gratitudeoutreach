import { describe, expect, it } from "vitest";
import { buildPharmacyPayload, buildQuickPayload, defaultTicks } from "@/lib/quick-ticks";
import { foodDataSchema, clothingDataSchema, counsellingDataSchema, pharmacyDataSchema } from "@/lib/schemas/service";
import type { LocalInventory } from "@/lib/offline/db";

const item = (id: string, name: string, remaining = 10): LocalInventory => ({
  id, station_id: "s", name, unit: "pack", sizes: null, opening_qty: 10, remaining, low_threshold: 2, updated_at: "",
});
const RICE = "0190a0b0-0000-7000-8000-000000000001";
const BEANS = "0190a0b0-0000-7000-8000-000000000002";

describe("quick ticks", () => {
  it("pharmacy: dispensing links the prescription and the counselling record, without naming medicines", () => {
    const RX = "0190a0b0-0000-7000-8000-0000000000aa";
    const C = "0190a0b0-0000-7000-8000-0000000000bb";
    const p = buildPharmacyPayload({ dispensed: [{ item_id: RICE, qty: 2 }], prescriptionId: RX, counsellingRecordId: C });
    expect(p.summary).toBe("Pharmacy completed");
    expect(p.data).toMatchObject({ items: [{ item_id: RICE, qty: 2 }], prescription_id: RX, counselling_record_id: C, outcomes: ["Medicine given"] });
    expect(pharmacyDataSchema.safeParse(p.data).success).toBe(true);
  });

  it("pharmacy: no prescription and out of stock both complete the step", () => {
    expect(buildPharmacyPayload({ dispensed: [], prescriptionId: null, counsellingRecordId: null }).data.outcomes).toEqual(["No medicine needed"]);
    expect(buildPharmacyPayload({ dispensed: [], prescriptionId: RICE, counsellingRecordId: null }).data.outcomes).toEqual(["Medicine not available"]);
  });

  it("counselling: generic summary, follow-up flag, valid data", () => {
    const p = buildQuickPayload("counselling", ["counselled", "followup"]);
    expect(p.summary).toBe("Counselling session");
    expect(p.data).toMatchObject({ followup_needed: true, risk: "none" });
    expect(counsellingDataSchema.safeParse(p.data).success).toBe(true);
  });

  it("food: one 'received' tick by default; items given are optional and decrement stock", () => {
    expect(defaultTicks("food")).toEqual(["received"]);
    const items = [item(RICE, "Rice pack"), item(BEANS, "Beans", 0)];
    expect(buildQuickPayload("food", ["received"], items).summary).toBe("Food");
    const p = buildQuickPayload("food", ["received"], items, [RICE]);
    expect(p.data).toMatchObject({ items: [{ item_id: RICE, qty: 1 }] });
    expect(p.summary).toBe("Rice pack");
    expect(foodDataSchema.safeParse(p.data).success).toBe(true);
  });

  it("clothing works with no stock set up", () => {
    const p = buildQuickPayload("clothing", ["received"], []);
    expect(p.summary).toBe("Clothes");
    expect(clothingDataSchema.safeParse(p.data).success).toBe(true);
  });

  it("refuses an empty checklist", () => {
    expect(() => buildQuickPayload("food", [])).toThrow();
  });
});
