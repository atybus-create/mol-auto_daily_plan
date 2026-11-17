import type { Employee, GeneratedPlanEmployee } from "@/types/plan";

export function planEmployeeToScheduleEmployee(person: GeneratedPlanEmployee): Employee {
  return {
    id: person.employee_key,
    name: person.display_name,
    group: person.group_name,
    duty: person.blocks.some(block => block.activity === "duty"),
    progress: { pick: 0, pack: 0 },
    blocks: person.blocks.map(block => ({
      start: block.start,
      end: block.end,
      kind: block.activity,
      source: block.source,
      reason: block.reason,
      locked: block.locked,
      override_id: block.override_id,
    })),
  };
}

export function warsawBusinessDate(now = new Date()) {
  return now.toLocaleDateString("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function reportingDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
