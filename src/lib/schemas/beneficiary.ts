import { z } from "zod";
import { normalizePhone } from "@/lib/utils";

import { isMinor } from "@/lib/constants";
export { AGE_RANGES, GENDERS, LANGUAGES, CHURCH_MEMBER, COMMUNITIES, isMinor, type AgeRange } from "@/lib/constants";

export const registrationDetailsSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter the person's full name").max(120),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || normalizePhone(v) !== null, "Use a Nigerian number, e.g. 0803 123 4567"),
    gender: z.enum(["female", "male", "undisclosed"], { message: "Choose a gender" }),
    age_range: z.enum(["0-12", "13-17", "18-35", "36-59", "60+"], { message: "Choose an age range" }),
    community: z.string().trim().max(80).optional(),
    household_size: z.number().int().min(1).max(50).optional(),
    church_member: z.enum(["yes", "no", "visitor"]).optional(),
    language: z.string().max(30).optional(),
    guardian_name: z.string().trim().max(120).optional(),
  })
  .superRefine((v, ctx) => {
    if (isMinor(v.age_range) && !v.guardian_name?.trim()) {
      ctx.addIssue({ code: "custom", path: ["guardian_name"], message: "Guardian name is required for children and teens" });
    }
  });
export type RegistrationDetails = z.infer<typeof registrationDetailsSchema>;

export const editDetailsSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().optional().refine((v) => !v || normalizePhone(v) !== null, "Use a Nigerian number"),
  community: z.string().trim().max(80).optional(),
});
