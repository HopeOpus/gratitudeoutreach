import { describe, expect, it } from "vitest";
import { buildQuickPayload, defaultTicks } from "@/lib/quick-ticks";
import { prayerDataSchema, foodDataSchema, clothingDataSchema, counsellingDataSchema, medicalDataSchema, medicalPayloadSchema } from "@/lib/schemas/service";
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

  it("medical: summary stays generic, ticks go to the confidential record only", () => {
    const p = buildQuickPayload("medical", ["seen", "medication"]);
    expect(p.summary).toBe("Medical check");
    expect(JSON.stringify(p.data)).not.toContain("Medication");
    expect(p.confidential?.kind).toBe("medical");
    expect(medicalDataSchema.safeParse(p.data).success).toBe(true);
    expect(medicalPayloadSchema.safeParse(p.confidential?.payload).success).toBe(true);
    expect(buildQuickPayload("medical", ["referred"]).summary).toBe("Medical check · referred");
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
