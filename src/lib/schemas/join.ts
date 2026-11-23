import { z } from "zod";
import { normalizePhone } from "@/lib/utils";

export const pinSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit PIN");

const nameField = z.string().trim().min(1, "Enter your name").max(60);
const phoneField = z.string().trim().min(1, "Enter your phone number").refine((v) => normalizePhone(v) !== null, "Use a Nigerian number, e.g. 0803 123 4567");

/** Register: name + phone (required, it becomes the sign-in password). */
export const whoSchema = z.object({ name: nameField, phone: phoneField });

/** Sign in on any device with the same name + phone used to register. */
export const signInSchema = z.object({ name: nameField, phone: phoneField });

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
