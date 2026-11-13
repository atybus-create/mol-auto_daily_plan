export type ProcessKind = "pick" | "pack";

export type ActivityKind = ProcessKind | "presence" | "duty" | "break" | "clean" | "returns";

export type ActivityBlock = {
  start: string;
  end: string;
  kind: ActivityKind;
  source?: "auto" | "manual";
  reason?: string;
  locked?: boolean;
  override_id?: string | null;
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

export type ActualInflowSlot = {
  pl: number;
  under: number;
  eligible_total: number;
  all_orders: number;
  sr_total: number;
  bl_total: number;
  rejected_allegro_one: number;
  rejected_other_after12: number;
  collected_at: string | null;
  data_status: string;
};

export type CorrectedForecastSlot = ForecastSlot & {
  actual: ActualInflowSlot | null;
  variance_to_forecast: number | null;
  effective_today: number;
  effective_source: "actual" | "forecast";
  cumulative_effective_today: number | null;
};

export type RealInflowSummary = {
  measured_slots: number;
  last_slot_end: string | null;
  eligible_actual: number;
  all_actual: number;
  pl_actual: number;
  under_actual: number;
  forecast_eligible_for_measured_slots: number;
  variance: number;
};

export type RemainingForecastSummary = {
  eligible_today: number;
  after_cutoff: number;
  gross_total: number;
  pl: number;
  under: number;
};

export type DayDemandV2Snapshot = Omit<DayDemandSnapshot, "slots"> & {
  contract_version: 2;
  actual_as_of: string | null;
  required_today_baseline: number | null;
  corrected_required_today: number | null;
  correction_vs_plan: number;
  corrected_plan_gross_total: number | null;
  real_inflow_to_now: RealInflowSummary;
  remaining_forecast: RemainingForecastSummary;
  slots: CorrectedForecastSlot[];
};

export type V3NowcastSlot = {
  total: number;
  eligible_today: number;
  after_cutoff: number;
  by_carrier: CourierForecast[];
};

export type V3ForecastSlot = ForecastSlot & {
  baseline: {
    total: number;
    eligible_today: number;
    after_cutoff: number;
  };
  actual: ActualInflowSlot | null;
  variance_to_forecast: number | null;
  nowcast: V3NowcastSlot;
  effective_today: number;
  effective_source: "actual" | "nowcast";
  cumulative_effective_today: number | null;
};

export type V3RealInflowSummary = {
  measured_slots: number;
  last_slot_end: string | null;
  eligible_actual: number;
  all_actual: number;
  pl_actual: number;
  under_actual: number;
  variance_to_baseline_gross: number | null;
};

export type V3RemainingForecastSummary = {
  eligible_today: number;
  after_cutoff: number;
  gross_total: number;
};

export type V3NowcastSummary = {
  baseline_gross: number | null;
  projected_final_from_pace: number | null;
  final_gross: number | null;
  remaining_gross: number;
  confidence: number;
  guardrail_applied: boolean;
};

export type DayDemandV3Snapshot = Omit<DayDemandSnapshot, "slots" | "forecast_kind"> & {
  contract_version: 3;
  forecast_kind: "BASELINE_PLUS_LIVE_NOWCAST";
  actual_as_of: string | null;
  baseline_source_model: string | null;
  baseline_forecast: ForecastTotals | null;
  required_today_baseline: number | null;
  corrected_required_today: number | null;
  correction_vs_plan: number | null;
  corrected_plan_gross_total: number | null;
  nowcast_forecast: V3NowcastSummary;
  real_inflow_to_now: V3RealInflowSummary;
  remaining_forecast: V3RemainingForecastSummary;
  slots: V3ForecastSlot[];
};

export type OrdersDemandSnapshot = DayDemandSnapshot | DayDemandV2Snapshot | DayDemandV3Snapshot;

export type DayDemandError = {
  ok: false;
  status: "unavailable";
  error: string;
  business_date?: string;
};

export type DayDemandResponse = DayDemandSnapshot | DayDemandError;
export type OrdersDemandResponse = OrdersDemandSnapshot | DayDemandError;

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

export type PlannerRole = "standard" | "receiving_support" | "specialist_reserve" | "leader_reserve" | "last_resort";
export type PreferredProcess = "balanced" | "pick" | "pack";
export type AuxiliaryPolicy = "none" | "clean_then_returns";

export type EmployeeProfile = {
  employee_key: string;
  display_name: string;
  group_name: string;
  can_pick: boolean;
  can_pack: boolean;
  active: boolean;
  es_login: string;
  max_hours: number;
  planner_role: PlannerRole;
  allocation_rank: number;
  preferred_process: PreferredProcess;
  supervisor_guard: boolean;
  auxiliary_policy: AuxiliaryPolicy;
  updated_at?: string | null;
};

export type PlannerNorms = {
  pick_per_hour: number;
  pack_per_hour: number;
  pick_seconds: number;
  pack_seconds: number;
};

export type PlanningAutomationSlotId = "initial" | "replan_1" | "replan_2" | "replan_3";

export type PlanningAutomationSlot = {
  id: PlanningAutomationSlotId;
  time: string;
  enabled: boolean;
};

export type PlanningAutomationSettings = {
  enabled: boolean;
  slots: PlanningAutomationSlot[];
  readiness_retry_minutes: number;
  readiness_timeout_minutes: number;
};

export type PlanTrigger = "BUTTON" | "AUTO" | "MANUAL";

export type PlanManualOverride = {
  override_id: string;
  employee_key: string;
  start: string;
  end: string;
  activity: ActivityKind;
  locked: true;
  created_at: string;
  reason: string;
};


export type GeneratedPlanBlock = {
  start: string;
  end: string;
  activity: ActivityKind;
  source: "auto" | "manual";
  reason: string;
  locked?: boolean;
  override_id?: string | null;
};

export type GeneratedPlanEmployee = {
  employee_key: string;
  display_name: string;
  group_name: string;
  planned_operational_minutes: number;
  planned_pick_minutes: number;
  planned_pack_minutes: number;
  blocks: GeneratedPlanBlock[];
};

export type PlanShortage = {
  process: "PICK" | "PAK";
  remaining_units: number;
  missing_rbh: number;
};

export type GeneratedPlanSummary = {
  target_orders: number;
  pick_target_tasks: number;
  pack_target_orders: number;
  pick_completed: number;
  pack_completed: number;
  initial_pick_remaining: number;
  initial_pack_remaining: number;
  final_pick_remaining: number;
  final_pack_remaining: number;
  planned_pick_rbh: number;
  planned_pack_rbh: number;
  initial_pack_queue: number;
  final_pack_queue: number;
  receiving_override_count: number;
  schedule_version: number;
  execution_snapshot_id: string | null;
  demand_generated_at: string | null;
  norms_version: number;
};

export type GeneratedPlanResponse = {
  ok: true;
  plan_id: string;
  business_date: string;
  generated_at: string;
  planning_from: string;
  status: "DRAFT_READY" | "CAPACITY_SHORTAGE";
  summary: GeneratedPlanSummary;
  shortages: PlanShortage[];
  employees: GeneratedPlanEmployee[];
  revision?: {
    version: number;
    trigger: PlanTrigger;
    parent_plan_id: string | null;
    created_at: string;
    manual_override_count: number;
  };
  manual_overrides?: PlanManualOverride[];
};

export type GeneratedPlanError = {
  ok: false;
  error: string;
  message?: string;
};

export type LatestGeneratedPlanResponse = {
  ok: true;
  business_date: string;
  current: Record<string, unknown> | null;
  plan: GeneratedPlanResponse | null;
  history: Record<string, unknown> | unknown[] | null;
};


export type ExecutionOperator = {
  operator: string;
  pick_completed: number;
  pack_completed: number;
};

export type EmployeeExecution = ExecutionOperator & {
  employee_key: string | null;
  operator_key: string;
  display_name: string;
  collected_at: string;
  data_status: string;
  mapped: boolean;
};

export type ExecutionSnapshotLatest = {
  snapshot_id: string | null;
  pick_completed: number;
  pack_completed: number;
  operators_count: number;
  operators: ExecutionOperator[];
  employee_execution?: EmployeeExecution[];
  unmapped_operators?: EmployeeExecution[];
  unmapped_count?: number;
  collected_at: string | null;
  next_refresh_at?: string | null;
  refresh_interval_minutes?: number;
  recommended_client_refresh_minutes?: number;
  age_minutes: number;
  data_status: string;
  error_message: string;
};

export type ExecutionSnapshotResponse = {
  ok: true;
  business_date: string;
  status: "ready" | "stale" | "error" | "partial";
  complete: boolean;
  generated_at: string;
  latest: ExecutionSnapshotLatest | null;
  refresh?: {
    source_interval_minutes: number;
    recommended_client_minutes: number;
    next_refresh_at: string | null;
  };
  warnings: string[];
};

export type ExecutionSnapshotError = {
  ok: false;
  error: string;
  message?: string;
};
