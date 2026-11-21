"use client";
import { getMeta, setMeta } from "./db";
import type { StationKind } from "@/lib/stations";

export interface VolunteerSession {
  session: {
    id: string;
    role: "volunteer" | "station_lead";
    display_name: string;
    designation: string | null;
    expires_at: string;
    station_id: string;
    edition_id: string;
  };
  station: {
    id: string;
    edition_id: string;
    kind: StationKind;
    name: string;
    icon: string | null;
    has_lead_pin: boolean;
  };
  edition: {
    id: string;
    name: string;
    code_prefix: string;
    status: "draft" | "live" | "closed";
    is_training: boolean;
    org_id: string;
  };
  org: { name: string; church_name: string | null; consent_text: string; consent_version: number };
}

export interface CodeBlock {
  prefix: string;
  range_end: number;
  next_value: number;
}

export const getSession = () => getMeta<VolunteerSession>("session");
export const saveSession = (s: VolunteerSession) => setMeta("session", s);

/** Device auto-purges 48h after its session expires (Architecture §7). */
export function sessionExpired(s: VolunteerSession | undefined, graceHours = 0): boolean {
  if (!s) return true;
  return new Date(s.session.expires_at).getTime() + graceHours * 3600_000 < Date.now();
}
