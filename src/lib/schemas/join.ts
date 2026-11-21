import { z } from "zod";
import { normalizePhone } from "@/lib/utils";

export const pinSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit PIN");

export const whoSchema = z.object({
  name: z.string().trim().min(1, "Enter your first name").max(60),
  phone: z.string().trim().optional().refine((v) => !v || normalizePhone(v) !== null, "Use a Nigerian number, e.g. 0803 123 4567"),
});

export const editionSchema = z.object({
  name: z.string().trim().min(3).max(100),
  code_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "2–6 letters/numbers, e.g. GO26"),
  starts_on: z.string().min(10),
  ends_on: z.string().min(10),
  venue: z.string().trim().max(200).optional(),
  clone_from: z.string().optional(),
  is_training: z.boolean().optional(),
});
export type EditionInput = z.infer<typeof editionSchema>;
