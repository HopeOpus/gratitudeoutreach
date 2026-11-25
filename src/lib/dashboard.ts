export type StationStat = {
  id: string; kind: string; name: string; icon: string | null; sort_order: number; enabled: boolean;
  served: number; pending: number; avg_service_seconds: number | null; active_volunteers: number;
  stock_remaining: number; stock_opening: number; stock_items: number;
};

export type DashboardStats = {
  generated_at: string;
  kpis: {
    registered: number; served_unique: number; services: number; on_site: number; checked_out: number;
    salvations: number; rededications: number; decisions: number; referrals: number; urgent_counselling: number;
    counselled: number; already_born_again: number; healings: number; hg_baptised_today: number; hg_baptised_before: number; tongues: number;
    minor_surgery: number; lab_patients: number; optician_patients: number;
    followups: number; volunteers: number; missing_followup_consent: number;
  };
  stations: StationStat[];
  low_stock: { id: string; name: string; remaining: number; low_threshold: number; station: string }[];
  urgent_flags: { id: string; kind: string; text: string; created_at: string; visit_id: string; card_code: string | null }[];
  devices: { session_id: string; name: string; device_label: string | null; station: string; station_kind: string; role: string;
    last_seen_at: string | null; pending_ops: number; oldest_pending_at: string | null; created_at: string; records: number }[];
  hourly: { hour: string; arrivals: number; services: Record<string, number> }[];
  demographics: { gender: Record<string, number>; age_range: Record<string, number>; communities: { community: string; count: number }[] };
  followups_by_status: Record<string, number>;
  followups_by_type: Record<string, number>;
  stock: { id: string; name: string; station: string; unit: string; opening: number; remaining: number; used: number }[];
  data_quality: { cards_voided: number; card_conflicts: number; visits_without_card: number };
};

export const FOLLOWUP_TYPE_LABEL: Record<string, string> = {
  salvation: "Salvation", rededication: "Rededication", prayer: "Prayer", counselling: "Counselling",
  counselling_urgent: "Urgent counselling", medical_referral: "Medical referral", fellowship: "Fellowship",
};
export const FOLLOWUP_STATUS_LABEL: Record<string, string> = {
  new: "New", assigned: "Assigned", contacted: "Contacted", completed: "Completed", unreachable: "Unreachable",
};
