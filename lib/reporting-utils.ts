import type { Employee, GeneratedPlanEmployee } from "@/types/plan";
import type { ReportingPerformanceRow } from "@/types/reporting";

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

export function reportingDateRange(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];

  const dates: string[] = [];
  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

export function productivityPercent(row: ReportingPerformanceRow) {
  const pickHours = Number(row.plan_pick_hours);
  const packHours = Number(row.plan_pack_hours);
  const pickCompleted = Number(row.pick_completed);
  const packCompleted = Number(row.pack_completed);
  if (![pickHours, packHours, pickCompleted, packCompleted].every(Number.isFinite)) return null;

  const plannedHours = pickHours + packHours;
  if (plannedHours <= 0) return null;
  return (Math.max(0, pickCompleted) + 3 * Math.max(0, packCompleted)) / (210 * plannedHours) * 100;
}
