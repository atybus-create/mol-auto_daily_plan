export const PLAN_ACTIVITIES = new Set(["pick", "pack", "presence", "clean", "returns", "break"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isQuarterTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute < 60 && minute % 15 === 0;
}

export function validOverrides(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 50 && value.every(item =>
    isRecord(item) &&
    typeof item.override_id === "string" && item.override_id.length > 0 && item.override_id.length <= 160 &&
    typeof item.employee_key === "string" && item.employee_key.length > 0 && item.employee_key.length <= 160 &&
    isQuarterTime(item.start) && isQuarterTime(item.end) && item.start < item.end &&
    typeof item.activity === "string" && PLAN_ACTIVITIES.has(item.activity) &&
    item.locked === true &&
    typeof item.created_at === "string" && !Number.isNaN(Date.parse(item.created_at)) &&
    typeof item.reason === "string" && item.reason.length <= 240
  );
}

export function validPlanVersion(expectedPlanId: unknown, expectedRevision: unknown): boolean {
  return (expectedPlanId === null || (
    typeof expectedPlanId === "string" && expectedPlanId.length > 0 && expectedPlanId.length <= 160
  )) && typeof expectedRevision === "number" &&
    Number.isSafeInteger(expectedRevision) && expectedRevision >= 0 &&
    (expectedPlanId !== null || expectedRevision === 0);
}

export function validRemoveIds(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 50 &&
    value.every(id => typeof id === "string" && id.length > 0 && id.length <= 160);
}
