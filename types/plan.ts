export type ProcessKind = "pick" | "pack";

export type ActivityKind = ProcessKind | "presence" | "duty" | "break" | "clean" | "returns";

export type ActivityBlock = {
  start: string;
  end: string;
  kind: ActivityKind;
};

export type Employee = {
  id: string;
  name: string;
  group: string;
  duty?: boolean;
  progress: Record<ProcessKind, number>;
  blocks: ActivityBlock[];
};

export type ForecastStatus = "ready" | "partial" | "stale" | "unavailable";
export type ForecastQuality = "low" | "medium" | "good";
export type CourierGroup = "allegro_one" | "inpost_orlen" | "other" | "unknown";
export type SlotEligibility = "eligible" | "partial" | "next_day" | "unknown";

export type DemandTotals = { pl: number; under: number; total: number };
export type ForecastTotals = DemandTotals & { p10: number; p90: number };

export type CourierForecast = {
  group: CourierGroup;
  point: number;
  p10: number;
  p90: number;
  eligible_today: number;
  after_cutoff: number;
  eligibility: SlotEligibility;
  cutoff_local: string | null;
};

export type ForecastSlot = {
  slot_start: string;
  slot_end: string;
  forecast: ForecastTotals;
  cumulative_forecast: number;
  cumulative_plan_gross: number | null;
  eligible_today: number;
  after_cutoff: number;
  by_carrier: CourierForecast[];
};

export type DayDemandSnapshot = {
  ok: true;
  business_date: string;
  timezone: "Europe/Warsaw";
  generated_at: string | null;
  source_as_of: string | null;
  model_version: string | null;
  trained_until: string | null;
  forecast_run_id: string | null;
  forecast_kind: "DAILY_BASELINE";
  status: ForecastStatus;
  quality?: ForecastQuality;
  morning: DemandTotals | null;
  forecast: ForecastTotals | null;
  plan_gross: DemandTotals | null;
  required_today: number | null;
  after_cutoff: number | null;
  slots: ForecastSlot[];
  warnings: string[];
};

export type DayDemandError = {
  ok: false;
  status: "unavailable";
  error: string;
  business_date?: string;
};

export type DayDemandResponse = DayDemandSnapshot | DayDemandError;

/** @deprecated Kept only for legacy demo fixtures. Production uses DayDemandSnapshot. */
export type OrderFlow = {
  plannedPL: number[];
  plannedUnder: number[];
  actualPL: number[];
  actualUnder: number[];
  morningPL: number;
  morningUnder: number;
  observedThrough: string;
};

export type AppTab = "work" | "orders" | "settings";

export type EmployeeProfile = {
  employee_key: string;
  display_name: string;
  group_name: string;
  can_pick: boolean;
  can_pack: boolean;
  active: boolean;
  es_login: string;
  max_hours: number;
  updated_at?: string | null;
};

export type PlannerNorms = {
  pick_per_hour: number;
  pack_per_hour: number;
  pick_seconds: number;
  pack_seconds: number;
};
