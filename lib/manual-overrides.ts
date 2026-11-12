import type { ActivityKind, PlanManualOverride } from "@/types/plan";

export type ManualOverrideInput = Partial<PlanManualOverride> & {
  employee_key?: unknown;
  start?: unknown;
  end?: unknown;
  activity?: unknown;
  reason?: unknown;
  override_id?: unknown;
};

const allowedActivities = new Set<ActivityKind>(["pick", "pack", "presence", "break", "clean", "returns"]);

export function normalizeManualOverrideInput(value: unknown): PlanManualOverride {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Nieprawidłowa korekta ręczna.");
  const input = value as ManualOverrideInput;
  const employeeKey = typeof input.employee_key === "string" ? input.employee_key.trim() : "";
  const start = typeof input.start === "string" ? input.start : "";
  const end = typeof input.end === "string" ? input.end : "";
  const activity = typeof input.activity === "string" ? input.activity as ActivityKind : null;

  if (!employeeKey) throw new Error("Brak pracownika dla korekty.");
  if (!isQuarterHour(start) || !isQuarterHour(end) || toMinutes(end) <= toMinutes(start)) {
    throw new Error("Korekta musi obejmować pełny blok 15-minutowy.");
  }
  if (!activity || !allowedActivities.has(activity)) throw new Error("Niedozwolona czynność korekty.");

  const overrideId = typeof input.override_id === "string" && input.override_id.trim()
    ? input.override_id.trim().slice(0, 160)
    : `manual_${employeeKey}_${start.replace(":", "")}_${end.replace(":", "")}`;
  const reason = typeof input.reason === "string" && input.reason.trim()
    ? input.reason.trim().slice(0, 240)
    : "Korekta lidera";

  return {
    override_id: overrideId,
    employee_key: employeeKey,
    start,
    end,
    activity,
    locked: true,
    created_at: new Date().toISOString(),
    reason,
  };
}

export function isQuarterHour(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return Number(value.slice(3)) % 15 === 0;
}

export function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
