import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { DEFAULT_PLANNING_AUTOMATION_SETTINGS, normalizePlanningAutomationSettings, validatePlanningAutomationSettings } from "./planning-settings.ts";

test("uses the fixed 06:05 / 08:05 / 12:05 / 16:05 schedule", () => {
  assert.deepEqual(
    DEFAULT_PLANNING_AUTOMATION_SETTINGS.slots.map(slot => [slot.id, slot.time, slot.enabled]),
    [
      ["initial", "06:05", true],
      ["replan_1", "08:05", true],
      ["replan_2", "12:05", true],
      ["replan_3", "16:05", true],
    ],
  );
});

test("normalizes missing planning config to fixed safe defaults", () => {
  const normalized = normalizePlanningAutomationSettings(undefined);
  assert.equal(normalized.enabled, true);
  assert.equal(normalized.readiness_retry_minutes, 5);
  assert.equal(normalized.readiness_timeout_minutes, 20);
  assert.equal(validatePlanningAutomationSettings(normalized), null);
});

test("ignores attempted time edits but preserves per-slot enable toggles", () => {
  const normalized = normalizePlanningAutomationSettings({
    enabled: false,
    slots: [
      { id: "initial", time: "07:17", enabled: false },
      { id: "replan_1", time: "09:43", enabled: true },
      { id: "replan_2", time: "13:11", enabled: false },
      { id: "replan_3", time: "18:59", enabled: true },
    ],
    readiness_retry_minutes: 17,
    readiness_timeout_minutes: 99,
  });
  assert.equal(normalized.enabled, true);
  assert.deepEqual(normalized.slots.map(slot => [slot.time, slot.enabled]), [
    ["06:05", false],
    ["08:05", true],
    ["12:05", false],
    ["16:05", true],
  ]);
  assert.equal(normalized.readiness_retry_minutes, 5);
  assert.equal(normalized.readiness_timeout_minutes, 20);
  assert.equal(validatePlanningAutomationSettings(normalized), null);
});

test("rejects malformed toggle sets", () => {
  const malformed = structuredClone(DEFAULT_PLANNING_AUTOMATION_SETTINGS);
  malformed.slots = [malformed.slots[0], malformed.slots[0], malformed.slots[2], malformed.slots[3]];
  assert.match(validatePlanningAutomationSettings(malformed) ?? "", /Nieprawidłowa/);
});
