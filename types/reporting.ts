import type { GeneratedPlanEmployee, GeneratedPlanSummary, PlanManualOverride, PlanShortage } from "@/types/plan";

export type ReportingPerformanceRow = {
  business_date: string;
  employee_key: string | null;
  display_name: string;
  operator: string | null;
  mapped: boolean;
  plan_pick_hours: number;
  plan_pack_hours: number;
  pick_completed: number;
  pack_completed: number;
  target_orders: number | null;
  plan_version: number | null;
  plan_id: string | null;
  snapshot_id: string | null;
  snapshot_collected_at: string | null;
  data_status: string;
};

export type ReportingPerformanceResponse = {
  ok: true;
  from: string;
  to: string;
  generated_at: string;
  rows: ReportingPerformanceRow[];
  warnings: string[];
};

export type ReportingPlanVersion = {
  plan_id: string;
  business_date: string;
  version: number;
  generated_at: string;
  planning_from: string | null;
  trigger: string;
  trigger_ref: string;
  mode: string;
  status: string;
  target_orders: number | null;
  summary: GeneratedPlanSummary | Record<string, unknown>;
  shortages: PlanShortage[];
  employees: GeneratedPlanEmployee[];
  manual_overrides: PlanManualOverride[];
  manual_override_count: number;
};

export type ReportingPlansResponse = {
  ok: true;
  business_date: string;
  generated_at: string;
  versions: ReportingPlanVersion[];
};

export type ReportingError = {
  ok: false;
  error: string;
  message?: string;
};
