import { describe, expect, it } from "vitest";
import { bpLevel, rbsLevel, abnormalVitals, worstLevel } from "@/lib/vitals";

describe("vital sign highlighting (FR-6.3)", () => {
  it("BP ≥ 140/90 warns, ≥ 160/100 is danger", () => {
    expect(bpLevel(120, 80)).toBe("normal");
    expect(bpLevel(142, 85)).toBe("warning");
    expect(bpLevel(130, 92)).toBe("warning");
    expect(bpLevel(165, 90)).toBe("danger");
    expect(bpLevel(150, 101)).toBe("danger");
  });
  it("RBS in mmol/L: ≥ 11.1 or < 3.9 warns, ≥ 16.7 or < 3.0 is danger", () => {
    expect(rbsLevel(6.1)).toBe("normal");
    expect(rbsLevel(11)).toBe("normal");
    expect(rbsLevel(11.6)).toBe("warning");
    expect(rbsLevel(3.5)).toBe("warning");
    expect(rbsLevel(18)).toBe("danger");
    expect(rbsLevel(2.8)).toBe("danger");
  });
  it("temperature is recorded as entered, never flagged", () => {
    expect(abnormalVitals({ temp_c: 27 })).toEqual([]);
    expect(abnormalVitals({ temp_c: 40 })).toEqual([]);
    expect(worstLevel({ temp_c: 27 })).toBe("normal");
  });
  it("summarises abnormal readings", () => {
    expect(abnormalVitals({ bp_sys: 170, bp_dia: 105, rbs_mmol_l: 14 })).toEqual(["BP 170/105", "RBS 14 mmol/L"]);
    expect(worstLevel({ bp_sys: 145 })).toBe("warning");
  });
});
