import { describe, expect, it } from "vitest";
import { buildQuickPayload, defaultTicks } from "@/lib/quick-ticks";
import { prayerDataSchema, foodDataSchema, clothingDataSchema, counsellingDataSchema, medicalDataSchema, medicalPayloadSchema, pharmacyDataSchema } from "@/lib/schemas/service";
import type { LocalInventory } from "@/lib/offline/db";

const item = (id: string, name: string, remaining = 10): LocalInventory => ({
  id, station_id: "s", name, unit: "pack", sizes: null, opening_qty: 10, remaining, low_threshold: 2, updated_at: "",
});
const RICE = "0190a0b0-0000-7000-8000-000000000001";
const BEANS = "0190a0b0-0000-7000-8000-000000000002";

describe("quick ticks", () => {
  it("prayer: 'Prayed for' is ticked by default", () => {
    expect(defaultTicks("prayer")).toEqual(["prayed"]);
  });

  it("prayer: salvation creates a decision (drives follow-ups) and passes the shared schema", () => {
    const p = buildQuickPayload("prayer", ["prayed", "healing", "salvation", "followup"]);
    expect(p.summary).toBe("Prayed for · Healing · Salvation · Wants follow-up");
    expect(p.data).toMatchObject({ decision: "salvation", wants_followup: true });
    expect(prayerDataSchema.safeParse(p.data).success).toBe(true);
  });

  it("prayer & counselling: one list covers both", () => {
    const p = buildQuickPayload("prayer", ["prayed", "counselled"]);
    expect(p.summary).toBe("Prayed for · Counselled");
    expect(prayerDataSchema.safeParse(p.data).success).toBe(true);
  });

  it("medical: summary stays generic; the prescription goes to the confidential record and refers to Pharmacy", () => {
    const PHARM = "0190a0b0-0000-7000-8000-0000000000ff";
    const p = buildQuickPayload("medical", ["seen"], [], [], {
      prescription: [{ item_id: RICE, name: "Paracetamol 500mg", qty: 2, dosage: "1 tab twice daily" }], pharmacyStationId: PHARM,
    });
    expect(p.summary).toBe("Medical check");
    expect(JSON.stringify(p.data)).not.toContain("Paracetamol");
    expect(p.data).toMatchObject({ refer_to_station_ids: [PHARM] });
    expect(p.confidential?.payload).toMatchObject({ prescription: [{ name: "Paracetamol 500mg", qty: 2 }] });
    expect(medicalDataSchema.safeParse(p.data).success).toBe(true);
    expect(medicalPayloadSchema.safeParse(p.confidential?.payload).success).toBe(true);
    expect(buildQuickPayload("medical", ["referred"]).summary).toBe("Medical check · referred");
    expect(buildQuickPayload("medical", ["seen"]).data).not.toHaveProperty("refer_to_station_ids");
  });

  it("pharmacy: dispensing reduces stock and links the prescription, without naming medicines", () => {
    const RX = "0190a0b0-0000-7000-8000-0000000000aa";
    const p = buildQuickPayload("pharmacy", ["given"], [], [], { dispensed: [{ item_id: RICE, qty: 2 }], prescriptionId: RX });
    expect(p.summary).toBe("Medicine given");
    expect(p.data).toMatchObject({ items: [{ item_id: RICE, qty: 2 }], prescription_id: RX });
    expect(pharmacyDataSchema.safeParse(p.data).success).toBe(true);
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
    expect(() => buildQuickPayload("prayer", [])).toThrow();
  });
});
