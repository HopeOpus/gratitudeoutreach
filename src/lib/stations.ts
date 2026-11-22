import {
  ClipboardPen, HandHeart, MessagesSquare, Stethoscope, Pill, UtensilsCrossed, Shirt, LogOut, Sparkles, type LucideIcon,
} from "lucide-react";

export type StationKind = "registration" | "prayer" | "counselling" | "medical" | "pharmacy" | "food" | "clothing" | "checkout" | "custom";

export const STATION_META: Record<StationKind, { label: string; icon: LucideIcon; text: string; bg: string; soft: string; border: string; confidential: boolean }> = {
  registration: { label: "Registration", icon: ClipboardPen, text: "text-st-registration", bg: "bg-st-registration", soft: "bg-forest-50", border: "border-st-registration", confidential: false },
  prayer: { label: "Prayer & Counselling", icon: HandHeart, text: "text-teal-700", bg: "bg-st-prayer", soft: "bg-teal-50", border: "border-st-prayer", confidential: false },
  counselling: { label: "Counselling (private notes)", icon: MessagesSquare, text: "text-confidential", bg: "bg-st-counselling", soft: "bg-confidential-bg", border: "border-st-counselling", confidential: true },
  medical: { label: "Medical", icon: Stethoscope, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  pharmacy: { label: "Pharmacy", icon: Pill, text: "text-danger", bg: "bg-st-medical", soft: "bg-danger-bg", border: "border-st-medical", confidential: true },
  food: { label: "Food", icon: UtensilsCrossed, text: "text-leaf-600", bg: "bg-st-food", soft: "bg-leaf-50", border: "border-st-food", confidential: false },
  clothing: { label: "Clothing", icon: Shirt, text: "text-fresh-700", bg: "bg-st-clothing", soft: "bg-fresh-50", border: "border-st-clothing", confidential: false },
  checkout: { label: "Checkout", icon: LogOut, text: "text-neutral-700", bg: "bg-st-custom", soft: "bg-neutral-50", border: "border-st-custom", confidential: false },
  custom: { label: "Custom", icon: Sparkles, text: "text-neutral-700", bg: "bg-st-custom", soft: "bg-neutral-50", border: "border-st-custom", confidential: false },
};

export function stationMeta(kind: string | null | undefined) {
  return STATION_META[(kind as StationKind) ?? "custom"] ?? STATION_META.custom;
}

export const CONFIDENTIAL_KINDS: StationKind[] = ["medical", "counselling", "pharmacy"];
export const isConfidentialKind = (k: string | null | undefined) => k === "medical" || k === "counselling" || k === "pharmacy";

/** Default 6-digit PIN rules shared by forms. */
export const PIN_RE = /^\d{6}$/;
