export const CUTOFF_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
] as const;

export type CutoffTime = (typeof CUTOFF_OPTIONS)[number];
export type CutoffMode = "STANDARD" | "CUSTOM";
export type CutoffScope = "DATE" | "WEEKDAY_DEFAULT";

export type DayCutoffState = {
  ok: true;
  business_date: string;
  mode: CutoffMode;
  cutoff_local: CutoffTime | null;
  default_cutoff_local: CutoffTime;
  effective_cutoff_local: CutoffTime;
  weekday_default_cutoff_local: CutoffTime;
  changed_at: string | null;
};

export function isCutoffTime(value: unknown): value is CutoffTime {
  return typeof value === "string" && CUTOFF_OPTIONS.some(option => option === value);
}

export function isCutoffDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isDayCutoffState(value: unknown): value is DayCutoffState {
  if (typeof value !== "object" || !value) return false;
  const state = value as Partial<DayCutoffState>;
  return state.ok === true && typeof state.business_date === "string"
    && ((state.mode === "STANDARD" && state.cutoff_local === null)
      || (state.mode === "CUSTOM" && isCutoffTime(state.cutoff_local)))
    && isCutoffTime(state.default_cutoff_local)
    && isCutoffTime(state.effective_cutoff_local)
    && isCutoffTime(state.weekday_default_cutoff_local)
    && state.effective_cutoff_local === (state.cutoff_local ?? state.default_cutoff_local)
    && (state.changed_at === null || typeof state.changed_at === "string");
}
