import { describe, expect, it } from "vitest";
import { bpLevel, rbsLevel, tempLevel, abnormalVitals, worstLevel } from "@/lib/vitals";

describe("vital sign highlighting (FR-6.3)", () => {
  it("BP ≥ 140/90 warns, ≥ 160/100 is danger", () => {
    expect(bpLevel(120, 80)).toBe("normal");
    expect(bpLevel(142, 85)).toBe("warning");
    expect(bpLevel(130, 92)).toBe("warning");
    expect(bpLevel(165, 90)).toBe("danger");
    expect(bpLevel(150, 101)).toBe("danger");
  });
  it("RBS ≥ 200 warns", () => {
    expect(rbsLevel(110)).toBe("normal");
    expect(rbsLevel(210)).toBe("warning");
    expect(rbsLevel(320)).toBe("danger");
  });
  it("fever", () => {
    expect(tempLevel(36.8)).toBe("normal");
    expect(tempLevel(38.2)).toBe("warning");
    expect(tempLevel(40)).toBe("danger");
  });
  it("summarises abnormal readings", () => {
    expect(abnormalVitals({ bp_sys: 170, bp_dia: 105, rbs_mg_dl: 250 })).toEqual(["BP 170/105", "RBS 250 mg/dL"]);
    expect(worstLevel({ bp_sys: 145 })).toBe("warning");
  });
});
