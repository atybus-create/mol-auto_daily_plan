import assert from "node:assert/strict";
import test from "node:test";
import { planEmployeeToScheduleEmployee, reportingDateLabel } from "./reporting-utils.ts";

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
