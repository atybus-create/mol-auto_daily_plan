import type { PlanningAutomationSettings } from "@/types/plan";

export const DEFAULT_PLANNING_AUTOMATION_SETTINGS: PlanningAutomationSettings = {
  enabled: true,
  slots: [
    { id: "initial", time: "06:00", enabled: true },
    { id: "replan_1", time: "08:00", enabled: true },
    { id: "replan_2", time: "12:00", enabled: true },
    { id: "replan_3", time: "16:00", enabled: true },
  ],
  readiness_retry_minutes: 5,
  readiness_timeout_minutes: 30,
};

const slotIds = ["initial", "replan_1", "replan_2", "replan_3"] as const;

export function normalizePlanningAutomationSettings(value: unknown): PlanningAutomationSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULT_PLANNING_AUTOMATION_SETTINGS);
  }
  const raw = value as Partial<PlanningAutomationSettings>;
  const incoming = Array.isArray(raw.slots) ? raw.slots : [];
  const byId = new Map(incoming.map(slot => [slot?.id, slot]));
  const slots = DEFAULT_PLANNING_AUTOMATION_SETTINGS.slots.map(defaultSlot => {
    const candidate = byId.get(defaultSlot.id);
    return {
      id: defaultSlot.id,
      time: isTime(candidate?.time) ? candidate!.time : defaultSlot.time,
      enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : defaultSlot.enabled,
    };
  });
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    slots,
    readiness_retry_minutes: clampInteger(raw.readiness_retry_minutes, 1, 30, 5),
    readiness_timeout_minutes: clampInteger(raw.readiness_timeout_minutes, 5, 120, 30),
  };
}

export function validatePlanningAutomationSettings(value: PlanningAutomationSettings) {
  if (!value.slots.every(slot => slotIds.includes(slot.id) && isTime(slot.time))) {
    return "Nieprawidłowe godziny automatycznego planowania.";
  }
  const enabledTimes = value.slots.filter(slot => slot.enabled).map(slot => slot.time);
  if (new Set(enabledTimes).size !== enabledTimes.length) {
    return "Aktywne godziny planowania nie mogą się powtarzać.";
  }
  const minutes = enabledTimes.map(toMinutes);
  for (let i = 1; i < minutes.length; i += 1) {
    if (minutes[i] <= minutes[i - 1]) {
      return "Aktywne godziny planowania muszą być ustawione rosnąco.";
    }
  }
  if (value.readiness_retry_minutes < 1 || value.readiness_retry_minutes > 30) {
    return "Częstotliwość ponowienia musi mieścić się w zakresie 1–30 min.";
  }
  if (value.readiness_timeout_minutes < 5 || value.readiness_timeout_minutes > 120) {
    return "Limit oczekiwania na dane musi mieścić się w zakresie 5–120 min.";
  }
  return null;
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}
