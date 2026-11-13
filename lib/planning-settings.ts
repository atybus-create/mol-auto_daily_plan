import type { PlanningAutomationSettings } from "@/types/plan";

export const DEFAULT_PLANNING_AUTOMATION_SETTINGS: PlanningAutomationSettings = {
  enabled: true,
  slots: [
    { id: "initial", time: "06:05", enabled: true },
    { id: "replan_1", time: "08:05", enabled: true },
    { id: "replan_2", time: "12:05", enabled: true },
    { id: "replan_3", time: "16:05", enabled: true },
  ],
  readiness_retry_minutes: 5,
  readiness_timeout_minutes: 20,
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
      time: defaultSlot.time,
      enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : defaultSlot.enabled,
    };
  });
  return {
    enabled: true,
    slots,
    readiness_retry_minutes: 5,
    readiness_timeout_minutes: 20,
  };
}

export function validatePlanningAutomationSettings(value: PlanningAutomationSettings) {
  if (!value.slots.every(slot => slotIds.includes(slot.id) && typeof slot.enabled === "boolean")) {
    return "Nieprawidłowa konfiguracja automatycznych przeliczeń.";
  }
  return null;
}

