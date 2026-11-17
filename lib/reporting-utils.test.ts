import assert from "node:assert/strict";
import test from "node:test";
import { planEmployeeToScheduleEmployee, productivityPercent, reportingDateLabel, reportingDateRange } from "./reporting-utils.ts";
import type { ReportingPerformanceRow } from "../types/reporting.ts";

test("maps a stored historical plan employee to the shared schedule contract", () => {
  const employee = planEmployeeToScheduleEmployee({
    employee_key: "anna",
    display_name: "Anna",
    group_name: "Wydanie",
    planned_operational_minutes: 120,
    planned_pick_minutes: 60,
    planned_pack_minutes: 60,
    blocks: [
      { start: "06:00", end: "07:00", activity: "pick", source: "auto", reason: "" },
      { start: "07:00", end: "08:00", activity: "pack", source: "manual", reason: "Korekta", locked: true, override_id: "o1" },
    ],
  });

  assert.equal(employee.id, "anna");
  assert.equal(employee.blocks[1].kind, "pack");
  assert.equal(employee.blocks[1].source, "manual");
  assert.equal(employee.blocks[1].locked, true);
});

test("formats reporting dates without a timezone shift", () => {
  assert.equal(reportingDateLabel("2026-11-16"), "16.11.2026");
});

test("builds an inclusive reporting date range", () => {
  assert.deepEqual(reportingDateRange("2026-11-13", "2026-11-16"), ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]);
  assert.deepEqual(reportingDateRange("2026-11-16", "2026-11-13"), []);
});

test("calculates productivity with one pack equal to three picks", () => {
  const row = {
    plan_pick_hours: 1,
    plan_pack_hours: 6.25,
    pick_completed: 324,
    pack_completed: 364,
  } as ReportingPerformanceRow;
  assert.equal(Number(productivityPercent(row)?.toFixed(1)), 93);
});

test("counts one full pick hour and one full pack hour as 100 percent", () => {
  const row = {
    plan_pick_hours: 1,
    plan_pack_hours: 1,
    pick_completed: 210,
    pack_completed: 70,
  } as ReportingPerformanceRow;
  assert.equal(productivityPercent(row), 100);
});

test("returns no productivity when no pick or pack work was planned", () => {
  const row = { plan_pick_hours: 0, plan_pack_hours: 0, pick_completed: 100, pack_completed: 100 } as ReportingPerformanceRow;
  assert.equal(productivityPercent(row), null);
});
