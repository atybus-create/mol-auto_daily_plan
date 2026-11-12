import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { buildOperatorPerformance } from "./operator-performance.ts";
import type { Employee, EmployeeProfile, ExecutionSnapshotResponse, PlannerNorms } from "../types/plan.ts";

const norms: PlannerNorms = { pick_per_hour: 120, pack_per_hour: 60, pick_seconds: 30, pack_seconds: 60 };

const employees: Employee[] = [
  {
    id: "alice",
    name: "Alice",
    group: "Wydanie",
    progress: { pick: 0, pack: 0 },
    blocks: [
      { start: "06:00", end: "06:15", kind: "pick" },
      { start: "06:15", end: "06:30", kind: "pick" },
      { start: "06:30", end: "07:00", kind: "pack" },
    ],
  },
  {
    id: "bob",
    name: "Bob",
    group: "Wydanie",
    progress: { pick: 0, pack: 0 },
    blocks: [{ start: "06:00", end: "06:15", kind: "pick" }],
  },
];

const profiles: EmployeeProfile[] = [profile("alice", "alice.es"), profile("bob", "bob.es")];

test("counts only fully closed blocks in the plan to the snapshot cutoff", () => {
  const execution = snapshot({
    collectedAt: "2026-06-01T04:20:00.000Z",
    pickTotal: 25,
    packTotal: 12,
    employeeExecution: [
      executionRow("alice", "alice.es", 20, 10),
    ],
    unmapped: [executionRow(null, "unknown.es", 5, 2, false)],
  });

  const model = buildOperatorPerformance(employees, profiles, execution, norms, "2026-06-01", new Date("2026-06-01T12:00:00Z"));
  const alice = model.rows[0];

  assert.equal(model.cutoffMinutes, 6 * 60 + 20);
  assert.equal(alice.processes.pick.plannedToCutoff, 30);
  assert.equal(alice.processes.pick.plannedDay, 60);
  assert.equal(alice.processes.pick.actualToCutoff, 20);
  assert.equal(Math.round(alice.processes.pick.cutoffRealization!), 67);
  assert.equal(Math.round(alice.processes.pick.dayRealization!), 33);
  assert.equal(alice.processes.pick.remaining, 40);
  assert.equal(alice.processes.pack.plannedToCutoff, 0);
  assert.equal(alice.processes.pack.plannedDay, 30);
  assert.equal(model.team.pick.actualDay, 25);
  assert.equal(model.unmappedOperators, 1);
});

test("keeps saved-plan employees visible even when the latest revision has no PICK/PAK blocks", () => {
  const savedPlanEmployees: Employee[] = [{
    id: "alice",
    name: "Alice",
    group: "Wydanie",
    progress: { pick: 0, pack: 0 },
    blocks: [{ start: "06:00", end: "14:00", kind: "presence" }],
  }];
  const execution = snapshot({
    collectedAt: "2026-06-01T04:20:00.000Z",
    pickTotal: 20,
    packTotal: 10,
    employeeExecution: [executionRow("alice", "alice.es", 20, 10)],
    unmapped: [],
  });

  const model = buildOperatorPerformance(savedPlanEmployees, [profile("alice", "alice.es")], execution, norms, "2026-06-01");

  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].id, "alice");
  assert.equal(model.rows[0].processes.pick.plannedDay, 0);
  assert.equal(model.rows[0].processes.pick.actualDay, 20);
  assert.equal(model.rows[0].processes.pick.dayRealization, null);
});

test("does not treat missing ES data as zero", () => {
  const execution = snapshot({
    collectedAt: "2026-06-01T04:20:00.000Z",
    pickTotal: 20,
    packTotal: 10,
    employeeExecution: [executionRow("alice", "alice.es", 20, 10)],
    unmapped: [],
  });

  const model = buildOperatorPerformance(employees, profiles, execution, norms, "2026-06-01");
  const bob = model.rows.find(row => row.id === "bob")!;

  assert.equal(bob.mapping, "no_data");
  assert.equal(bob.processes.pick.actualDay, null);
  assert.equal(bob.processes.pick.dayRealization, null);
  assert.equal(bob.processes.pick.remaining, null);
});

test("uses the entire plan for a past day when no snapshot timestamp is available", () => {
  const model = buildOperatorPerformance(employees, profiles, null, norms, "2026-05-31", new Date("2026-06-01T10:00:00Z"));

  assert.equal(model.rows[0].processes.pick.plannedToCutoff, model.rows[0].processes.pick.plannedDay);
  assert.equal(model.rows[0].processes.pack.plannedToCutoff, model.rows[0].processes.pack.plannedDay);
  assert.equal(model.team.pick.actualDay, null);
});

test("does not turn an error snapshot total into team execution", () => {
  const execution = snapshot({
    collectedAt: "2026-06-01T04:20:00.000Z",
    pickTotal: 0,
    packTotal: 0,
    employeeExecution: [],
    unmapped: [],
  });
  execution.status = "error";
  execution.latest!.data_status = "ERROR";

  const model = buildOperatorPerformance(employees, profiles, execution, norms, "2026-06-01");

  assert.equal(model.team.pick.actualDay, null);
  assert.equal(model.team.pack.actualDay, null);
});

function profile(employeeKey: string, login: string): EmployeeProfile {
  return {
    employee_key: employeeKey,
    display_name: employeeKey,
    group_name: "Wydanie",
    can_pick: true,
    can_pack: true,
    active: true,
    es_login: login,
    max_hours: 8,
    planner_role: "standard",
    allocation_rank: 1,
    preferred_process: "balanced",
    supervisor_guard: false,
    auxiliary_policy: "none",
  };
}

function executionRow(employeeKey: string | null, login: string, pick: number, pack: number, mapped = true) {
  return {
    employee_key: employeeKey,
    operator_key: login.toLowerCase(),
    operator: login,
    display_name: login,
    pick_completed: pick,
    pack_completed: pack,
    collected_at: "2026-06-01T04:20:00.000Z",
    data_status: "OK",
    mapped,
  };
}

function snapshot(input: {
  collectedAt: string;
  pickTotal: number;
  packTotal: number;
  employeeExecution: ReturnType<typeof executionRow>[];
  unmapped: ReturnType<typeof executionRow>[];
}): ExecutionSnapshotResponse {
  return {
    ok: true,
    business_date: "2026-06-01",
    status: "ready",
    complete: true,
    generated_at: input.collectedAt,
    warnings: [],
    latest: {
      snapshot_id: "snapshot-1",
      pick_completed: input.pickTotal,
      pack_completed: input.packTotal,
      operators_count: input.employeeExecution.length + input.unmapped.length,
      operators: [...input.employeeExecution, ...input.unmapped],
      employee_execution: input.employeeExecution,
      unmapped_operators: input.unmapped,
      collected_at: input.collectedAt,
      age_minutes: 5,
      data_status: "OK",
      error_message: "",
    },
  };
}
