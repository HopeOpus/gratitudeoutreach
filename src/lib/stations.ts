import {
  ClipboardPen, HandHeart, MessagesSquare, Stethoscope, Pill, UtensilsCrossed, Shirt, LogOut, Sparkles, HeartPulse, Glasses, FlaskConical, type LucideIcon,
} from "lucide-react";

export type StationKind = "registration" | "medical_assistant" | "medical" | "optician" | "laboratory" | "prayer" | "counselling" | "pharmacy" | "food" | "clothing" | "checkout" | "custom";

export const STATION_META: Record<StationKind, { label: string; icon: LucideIcon; text: string; bg: string; soft: string; border: string; confidential: boolean }> = {
  registration: { label: "Registration", icon: ClipboardPen, text: "text-st-registration", bg: "bg-st-registration", soft: "bg-forest-50", border: "border-st-registration", confidential: false },
  prayer: { label: "Counselling", icon: HandHeart, text: "text-teal-700", bg: "bg-st-prayer", soft: "bg-teal-50", border: "border-st-prayer", confidential: false },
  counselling: { label: "Counselling (private notes)", icon: MessagesSquare, text: "text-confidential", bg: "bg-st-counselling", soft: "bg-confidential-bg", border: "border-st-counselling", confidential: true },
  medical_assistant: { label: "Medical Assistant", icon: HeartPulse, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  optician: { label: "Optician", icon: Glasses, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  laboratory: { label: "Laboratory", icon: FlaskConical, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  medical: { label: "General Doctor", icon: Stethoscope, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  pharmacy: { label: "Pharmacy", icon: Pill, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  food: { label: "Food", icon: UtensilsCrossed, text: "text-leaf-600", bg: "bg-st-food", soft: "bg-leaf-50", border: "border-st-food", confidential: false },
  clothing: { label: "Clothing", icon: Shirt, text: "text-fresh-700", bg: "bg-st-clothing", soft: "bg-fresh-50", border: "border-st-clothing", confidential: false },
  checkout: { label: "Checkout", icon: LogOut, text: "text-neutral-700", bg: "bg-st-custom", soft: "bg-neutral-50", border: "border-st-custom", confidential: false },
  custom: { label: "Custom", icon: Sparkles, text: "text-neutral-700", bg: "bg-st-custom", soft: "bg-neutral-50", border: "border-st-custom", confidential: false },
};

export function stationMeta(kind: string | null | undefined) {
  return STATION_META[(kind as StationKind) ?? "custom"] ?? STATION_META.custom;
}

/** The medical team shares one medical record. */
export const MEDICAL_KINDS: StationKind[] = ["medical_assistant", "medical", "optician", "laboratory", "pharmacy"];
export const isMedicalKind = (k: string | null | undefined) => MEDICAL_KINDS.includes(k as StationKind);
/** Being sent here is itself medical detail: only the medical team sees needs, records and alerts for these. */
export const isPrivateKind = (k: string | null | undefined) => k === "optician" || k === "laboratory";
export const CONFIDENTIAL_KINDS: StationKind[] = [...MEDICAL_KINDS, "counselling"];
export const isConfidentialKind = (k: string | null | undefined) => CONFIDENTIAL_KINDS.includes(k as StationKind);

/** Default 6-digit PIN rules shared by forms. */
export const PIN_RE = /^\d{6}$/;
