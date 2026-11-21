/** Vital-sign range hints for the Medical form (FR-6.3). Not clinical advice. */
export type VitalLevel = "normal" | "warning" | "danger";
export type Vitals = { bp_sys?: number; bp_dia?: number; pulse?: number; temp_c?: number; weight_kg?: number; rbs_mg_dl?: number; height_cm?: number };

export function bpLevel(sys?: number, dia?: number): VitalLevel {
  if (sys == null && dia == null) return "normal";
  if ((sys ?? 0) >= 160 || (dia ?? 0) >= 100) return "danger";
  if ((sys ?? 0) >= 140 || (dia ?? 0) >= 90) return "warning";
  if ((sys != null && sys < 90) || (dia != null && dia < 60)) return "warning";
  return "normal";
}

export function rbsLevel(v?: number): VitalLevel {
  if (v == null) return "normal";
  if (v >= 300 || v < 54) return "danger";
  if (v >= 200 || v < 70) return "warning";
  return "normal";
}

export function tempLevel(v?: number): VitalLevel {
  if (v == null) return "normal";
  if (v >= 39.5 || v < 35) return "danger";
  if (v >= 37.8) return "warning";
  return "normal";
}

export function pulseLevel(v?: number): VitalLevel {
  if (v == null) return "normal";
  if (v >= 130 || v < 40) return "danger";
  if (v > 100 || v < 50) return "warning";
  return "normal";
}

export const LEVEL_HINT: Record<VitalLevel, string> = {
  normal: "",
  warning: "Outside normal range: check again",
  danger: "High: consider referral",
};

export function abnormalVitals(v: Vitals): string[] {
  const out: string[] = [];
  const bp = bpLevel(v.bp_sys, v.bp_dia);
  if (bp !== "normal") out.push(`BP ${v.bp_sys ?? "?"}/${v.bp_dia ?? "?"}`);
  if (rbsLevel(v.rbs_mg_dl) !== "normal") out.push(`RBS ${v.rbs_mg_dl} mg/dL`);
  if (tempLevel(v.temp_c) !== "normal") out.push(`Temp ${v.temp_c} °C`);
  if (pulseLevel(v.pulse) !== "normal") out.push(`Pulse ${v.pulse}`);
  return out;
}

export function worstLevel(v: Vitals): VitalLevel {
  const levels = [bpLevel(v.bp_sys, v.bp_dia), rbsLevel(v.rbs_mg_dl), tempLevel(v.temp_c), pulseLevel(v.pulse)];
  return levels.includes("danger") ? "danger" : levels.includes("warning") ? "warning" : "normal";
}
