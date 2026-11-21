// Zod-free display constants (keeps zod out of the initial /s bundle).
export const AGE_RANGES = [
  { value: "0-12", label: "0–12", long: "Child 0–12" },
  { value: "13-17", label: "13–17", long: "Teen 13–17" },
  { value: "18-35", label: "18–35", long: "Young adult 18–35" },
  { value: "36-59", label: "36–59", long: "Adult 36–59" },
  { value: "60+", label: "60+", long: "Senior 60+" },
] as const;
export type AgeRange = (typeof AGE_RANGES)[number]["value"];

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "undisclosed", label: "Prefer not to say" },
] as const;

export const LANGUAGES = ["English", "Pidgin", "Hausa", "Igbo", "Yoruba", "Other"] as const;
export const CHURCH_MEMBER = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "visitor", label: "Visitor" },
] as const;

export const COMMUNITIES = ["Kpegi", "Jikwoyi", "Karu", "Nyanya", "Kugbo", "Orozo", "Karshi", "Mararaba", "Kurudu", "Gwagwa", "Kabusa", "Lugbe"] as const;

export const isMinor = (age: string | null | undefined) => age === "0-12" || age === "13-17";
