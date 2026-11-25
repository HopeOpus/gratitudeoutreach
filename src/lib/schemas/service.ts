import { z } from "zod";

const id = z.guid();
const notes = z.string().max(2000).optional();
const refer = z.array(id).max(6).optional();
/** Ticked outcomes from the quick checklist (e.g. "Prayed for"). */
const outcomes = z.array(z.string().max(60)).max(12).optional();

export const PRAYER_FOCUS = ["Health", "Family", "Finances", "Job", "Spiritual growth", "Deliverance", "Other"] as const;
export const COUNSELLING_CATEGORIES = ["Marriage/Family", "Grief", "Addiction", "Mental wellbeing", "Career/Finance", "Spiritual", "Youth", "Other"] as const;
export const MEDICAL_COMPLAINTS = ["Fever", "Headache", "Body pain", "Cough", "Eye", "Hypertension follow-up", "Diabetes follow-up", "Skin", "Other"] as const;
export const MEDICAL_TESTS = ["Malaria RDT", "Sugar (RBS)", "Urinalysis", "Pregnancy test", "Blood group", "Genotype", "PCV", "Hepatitis B", "HIV screening", "Typhoid (Widal)"] as const;
export const DESIGNATIONS = ["Dr", "Nurse", "Optician", "Lab", "Pharm", "Other"] as const;

export const FAITH = ["new_convert", "born_again", "neither"] as const;
export const HOLY_GHOST = ["already", "today", "not_yet"] as const;

/** Counselling station (kind `prayer`): the shared record only says counselling is done. */
export const counsellingDoneSchema = z.object({ counselled: z.literal(true), refer_to_station_ids: refer });

/** Spiritual outcomes: confidential kind `spiritual` (Counselling and coordinators). */
export const spiritualPayloadSchema = z.object({
  faith: z.enum(FAITH),
  rededicated: z.boolean(),
  prayed: z.boolean(),
  healing: z.boolean(),
  holy_ghost: z.enum(HOLY_GHOST),
  tongues: z.boolean(),
  wants_followup: z.boolean(),
  join_fellowship: z.boolean(),
  focus: z.array(z.string().max(40)).max(10),
  notes,
});
export type SpiritualPayload = z.infer<typeof spiritualPayloadSchema>;

/** Before 25 Nov 2026 the Prayer station saved this shape; old records still use it. */
export const prayerDataSchema = z.object({
  focus: z.array(z.string().max(40)).max(10),
  decision: z.enum(["none", "salvation", "rededication"]),
  wants_followup: z.boolean(),
  join_fellowship: z.boolean(),
  outcomes,
  notes,
  refer_to_station_ids: refer,
});
export type PrayerData = z.infer<typeof prayerDataSchema>;

export const foodDataSchema = z.object({
  items: z.array(z.object({ item_id: id, qty: z.number().int().min(1).max(20) })),
  household_served: z.number().int().min(1).max(50).optional(),
  override_by: z.string().max(80).optional(),
  outcomes,
  notes,
  refer_to_station_ids: refer,
});
export type FoodData = z.infer<typeof foodDataSchema>;

export const clothingDataSchema = z.object({
  items: z.array(z.object({ item_id: id, size: z.string().max(20).optional(), qty: z.number().int().min(1).max(20) })),
  for: z.enum(["self", "child", "other"]),
  outcomes,
  notes,
  refer_to_station_ids: refer,
});
export type ClothingData = z.infer<typeof clothingDataSchema>;

export const counsellingDataSchema = z.object({
  category: z.string().max(40),
  followup_needed: z.boolean(),
  risk: z.enum(["none", "pastoral", "urgent"]),
  refer_medical: z.boolean(),
  outcomes,
  refer_to_station_ids: refer,
});
export type CounsellingData = z.infer<typeof counsellingDataSchema>;

export const counsellingPayloadSchema = z.object({
  notes: z.string().max(5000),
  preferred_time: z.string().max(80).optional(),
});
export type CounsellingPayload = z.infer<typeof counsellingPayloadSchema>;

export const medicalDataSchema = z.object({
  tests: z.array(z.string().max(40)).max(12),
  referred: z.boolean(),
  referral_urgency: z.enum(["routine", "urgent"]).optional(),
  items: z.array(z.object({ item_id: id, qty: z.number().int().min(1).max(100) })),
  refer_to_station_ids: refer,
});
export type MedicalData = z.infer<typeof medicalDataSchema>;

/** A medicine Medical prescribes; Pharmacy dispenses from it. Confidential (medical payload only). */
export const rxLineSchema = z.object({
  item_id: id, name: z.string().min(1).max(120), qty: z.number().int().min(1).max(100), dosage: z.string().max(120).optional(),
});

const vital = (min: number, max: number) => z.number().min(min).max(max).optional();
export const vitalsSchema = z.object({
  bp_sys: vital(50, 260), bp_dia: vital(30, 180), pulse: vital(20, 250), temp_c: vital(30, 45),
  weight_kg: vital(1, 300), rbs_mg_dl: vital(10, 900), height_cm: vital(30, 250),
});
const testName = z.string().min(1).max(60);

/** Medical Assistant */
export const vitalsPayloadSchema = z.object({ vitals: vitalsSchema, designation: z.enum(DESIGNATIONS), notes });
/** Laboratory: results for tests the doctor asked for (or walk-up tests). */
export const labPayloadSchema = z.object({
  lab_results: z.array(z.object({ test: testName, result: z.string().min(1).max(300), abnormal: z.boolean() })).min(1).max(20),
  designation: z.enum(DESIGNATIONS),
  notes,
});
/** Optician */
export const eyePayloadSchema = z.object({
  eye: z.object({
    va_right: z.string().max(40).optional(), va_left: z.string().max(40).optional(),
    findings: z.string().max(1000).optional(), outcomes: z.array(z.string().max(60)).max(8),
  }),
  prescription: z.array(rxLineSchema).max(20).optional(),
  refer_to_station_ids: refer,
  designation: z.enum(DESIGNATIONS),
});
export const EYE_OUTCOMES = ["Reading glasses given", "Glasses prescribed", "Eye drops needed", "Refer to eye hospital", "No problem found"] as const;

/** General Doctor */
export const medicalPayloadSchema = z.object({
  vitals: vitalsSchema,
  complaint: z.array(z.string().max(40)).max(12),
  complaint_text: z.string().max(1000).optional(),
  impression: z.string().max(2000).optional(),
  dispensed: z.array(z.object({ item_id: id, qty: z.number().int().min(1).max(100), dosage: z.string().max(120).optional() })),
  referral: z.object({ facility: z.string().max(120), reason: z.string().max(500), urgency: z.enum(["routine", "urgent"]) }).optional(),
  allergies: z.string().max(300).optional(),
  designation: z.enum(DESIGNATIONS),
  outcomes,
  prescription: z.array(rxLineSchema).max(20).optional(),
  tests_requested: z.array(testName).max(20).optional(),
  minor_surgery: z.enum(["needed", "done"]).optional(),
  minor_surgery_note: z.string().max(500).optional(),
  /** Kept here, not in the shared record: going to the Laboratory or Optician is medical detail. */
  refer_to_station_ids: refer,
  notes,
});
export type MedicalPayload = z.infer<typeof medicalPayloadSchema>;

export const pharmacyDataSchema = z.object({
  items: z.array(z.object({ item_id: id, qty: z.number().int().min(1).max(100) })),
  prescription_id: id.optional(),
  counselling_record_id: id.optional(),
  override_by: z.string().max(80).optional(),
  outcomes,
  notes,
  refer_to_station_ids: refer,
});
export type PharmacyData = z.infer<typeof pharmacyDataSchema>;

export const genericDataSchema = z.object({ notes, outcomes, refer_to_station_ids: refer }).catchall(z.unknown());

export const serviceDataSchemaByKind = {
  prayer: prayerDataSchema,
  food: foodDataSchema,
  clothing: clothingDataSchema,
  counselling: counsellingDataSchema,
  medical: medicalDataSchema,
  pharmacy: pharmacyDataSchema,
} as const;

export const serviceRecordSchema = z.object({
  id,
  edition_id: id,
  visit_id: id,
  station_id: id,
  session_id: id,
  served_by_name: z.string().min(1).max(60),
  summary: z.string().min(1).max(140),
  data: z.record(z.string(), z.unknown()),
  has_confidential: z.boolean(),
  served_at: z.string(),
});
export type ServiceRecordInsert = z.infer<typeof serviceRecordSchema>;
