import type { Employee, ProcessKind, PlannerNorms } from "@/types/plan";

export const SLOT_MINUTES = 5;
export const START_MINUTES = 5 * 60;
export const END_MINUTES = 18 * 60;
export const SLOT_COUNT = (END_MINUTES - START_MINUTES) / SLOT_MINUTES;
export const DEFAULT_PLANNER_NORMS: PlannerNorms = {
  pick_per_hour: 210,
  pack_per_hour: 70,
  pick_seconds: 22,
  pack_seconds: 50,
};

export const PROCESS_NORMS: Record<ProcessKind, number> = { pick: 210, pack: 70 };

export const activityLabels = {
  pick: "PICK",
  pack: "PAK",
  presence: "Obecność",
  duty: "Dyżur",
  break: "Przerwa",
  clean: "Porządki",
  returns: "Zwroty",
} as const;

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function activityMinutes(employee: Employee, kind: ProcessKind, until = END_MINUTES) {
  return employee.blocks.reduce((sum, block) => {
    if (block.kind !== kind) return sum;
    const toMinute = Math.min(timeToMinutes(block.end), until);
    return sum + Math.max(0, toMinute - timeToMinutes(block.start));
  }, 0);
}

export function targetFor(employee: Employee, process: ProcessKind, norms: PlannerNorms = DEFAULT_PLANNER_NORMS) {
  const rate = process === "pick" ? norms.pick_per_hour : norms.pack_per_hour;
  return Math.round((activityMinutes(employee, process) / 60) * rate);
}

export function dailyWorkedHours(employee: Employee) {
  return employee.blocks.reduce(
    (sum, block) => block.kind === "break" ? sum : sum + (timeToMinutes(block.end) - timeToMinutes(block.start)) / 60,
    0,
  );
}

export function currentActual(employee: Employee, process: ProcessKind, norms: PlannerNorms = DEFAULT_PLANNER_NORMS) {
  const rate = process === "pick" ? norms.pick_per_hour : norms.pack_per_hour;
  return Math.round((activityMinutes(employee, process, 10 * 60) / 60) * rate * employee.progress[process]);
}

export function currentPlan(employee: Employee, process: ProcessKind, norms: PlannerNorms = DEFAULT_PLANNER_NORMS) {
  const rate = process === "pick" ? norms.pick_per_hour : norms.pack_per_hour;
  return Math.round((activityMinutes(employee, process, 10 * 60) / 60) * rate);
}

export function slotsAt(time: string) {
  return (timeToMinutes(time) - START_MINUTES) / SLOT_MINUTES;
}

export function formatNumber(number: number) {
  return new Intl.NumberFormat("pl-PL").format(number);
}

export function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isMonday(date: string) {
  return new Date(`${date}T12:00:00`).getDay() === 1;
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T12:00:00`),
  );
}
