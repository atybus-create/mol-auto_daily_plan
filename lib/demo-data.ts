import type { Employee, OrderFlow } from "@/types/plan";

export const DEMO_DATE = "2026-11-09";

export const demoEmployees: Employee[] = [
  { id: "employee-1", name: "Pracownik 1", group: "Zespół wydania", progress: { pick: 1.04, pack: 0.98 }, blocks: [{ start: "09:30", end: "11:00", kind: "pick" }, { start: "11:00", end: "11:30", kind: "break" }, { start: "11:30", end: "13:00", kind: "pick" }, { start: "13:00", end: "15:00", kind: "pack" }, { start: "15:00", end: "16:30", kind: "pick" }, { start: "16:30", end: "17:00", kind: "duty" }] },
  { id: "employee-2", name: "Pracownik 2", group: "Zespół wydania", progress: { pick: 0.89, pack: 0.93 }, blocks: [{ start: "06:00", end: "09:00", kind: "pack" }, { start: "09:00", end: "09:30", kind: "break" }, { start: "09:30", end: "11:30", kind: "pack" }, { start: "11:30", end: "12:00", kind: "break" }, { start: "12:00", end: "13:30", kind: "pick" }, { start: "13:30", end: "15:00", kind: "pack" }, { start: "15:00", end: "16:00", kind: "clean" }, { start: "16:00", end: "16:30", kind: "duty" }] },
  { id: "employee-3", name: "Pracownik 3", group: "Zespół wydania", progress: { pick: 0.86, pack: 0.84 }, blocks: [{ start: "06:00", end: "09:30", kind: "pack" }, { start: "09:30", end: "10:30", kind: "pick" }, { start: "10:30", end: "11:00", kind: "break" }, { start: "11:00", end: "12:30", kind: "pack" }, { start: "12:30", end: "14:30", kind: "pack" }, { start: "14:30", end: "15:00", kind: "returns" }, { start: "15:00", end: "16:30", kind: "pack" }] },
  { id: "employee-4", name: "Pracownik 4", group: "Zespół wydania", progress: { pick: 0.98, pack: 1.03 }, blocks: [{ start: "06:30", end: "08:30", kind: "pick" }, { start: "08:30", end: "09:00", kind: "break" }, { start: "09:00", end: "11:30", kind: "pack" }, { start: "11:30", end: "12:00", kind: "break" }, { start: "12:00", end: "14:00", kind: "pack" }, { start: "14:00", end: "15:00", kind: "returns" }, { start: "15:00", end: "16:30", kind: "pick" }] },
  { id: "employee-5", name: "Pracownik 5", group: "Zespół wydania", progress: { pick: 0.94, pack: 0.91 }, blocks: [{ start: "06:00", end: "09:00", kind: "pick" }, { start: "09:00", end: "10:00", kind: "pack" }, { start: "10:00", end: "10:30", kind: "break" }, { start: "10:30", end: "12:00", kind: "pick" }, { start: "12:00", end: "12:30", kind: "break" }, { start: "12:30", end: "14:00", kind: "returns" }, { start: "14:00", end: "16:00", kind: "pack" }] },
  { id: "employee-6", name: "Pracownik 6", group: "Zespół wydania", progress: { pick: 0.91, pack: 0.95 }, blocks: [{ start: "07:00", end: "09:30", kind: "pack" }, { start: "09:30", end: "10:30", kind: "pick" }, { start: "10:30", end: "11:00", kind: "break" }, { start: "11:00", end: "13:00", kind: "pack" }, { start: "13:00", end: "15:30", kind: "pick" }, { start: "15:30", end: "16:30", kind: "clean" }, { start: "16:30", end: "17:00", kind: "duty" }] },
  { id: "employee-7", name: "Pracownik 7", group: "Zespół wydania", progress: { pick: 1.01, pack: 0.88 }, blocks: [{ start: "06:30", end: "09:30", kind: "pack" }, { start: "09:30", end: "10:00", kind: "break" }, { start: "10:00", end: "12:30", kind: "pick" }, { start: "12:30", end: "14:30", kind: "pack" }, { start: "14:30", end: "15:30", kind: "returns" }, { start: "15:30", end: "17:00", kind: "pack" }] },
  { id: "employee-8", name: "Pracownik 8", group: "Zespół wydania", progress: { pick: 0.82, pack: 1 }, blocks: [{ start: "08:00", end: "10:30", kind: "pick" }, { start: "10:30", end: "11:00", kind: "break" }, { start: "11:00", end: "12:30", kind: "pack" }, { start: "12:30", end: "14:30", kind: "pick" }, { start: "14:30", end: "15:00", kind: "break" }, { start: "15:00", end: "16:30", kind: "pack" }] },
];

export const demoOrderFlow: OrderFlow = {
  plannedPL: [1, 0, 1, 1, 1, 2, 3, 1, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0],
  plannedUnder: [15, 14, 30, 28, 36, 35, 56, 52, 51, 50, 50, 50, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 0, 0],
  actualPL: [1, 0, 1, 1, 2, 1, 3, 1],
  actualUnder: [15, 14, 28, 29, 36, 35, 50, 52],
  morningPL: 164,
  morningUnder: 3033,
  observedThrough: "10:00",
};
