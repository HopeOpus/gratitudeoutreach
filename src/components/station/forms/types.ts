import type { LocalVisit, LocalStation } from "@/lib/offline/db";
import type { VolunteerSession } from "@/lib/offline/session";

export type ServicePayload = {
  summary: string;
  data: Record<string, unknown>;
  confidential?: { kind: "medical" | "counselling"; payload: Record<string, unknown> } | null;
  flags?: { kind: string; scope: "all" | "medical" | "counselling" | "leads"; text: string }[];
};

export type FormProps = {
  visit: LocalVisit;
  session: VolunteerSession;
  stations: LocalStation[];
  saving: boolean;
  onSubmit: (p: ServicePayload) => void;
};
