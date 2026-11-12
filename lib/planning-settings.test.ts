import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node strip-types runner uses explicit TS extension.
import {
  DEFAULT_PLANNING_AUTOMATION_SETTINGS,
  normalizePlanningAutomationSettings,
  validatePlanningAutomationSettings,
} from "./planning-settings.ts";

test("uses the agreed 06:00 / 08:00 / 12:00 / 16:00 defaults", () => {
  assert.deepEqual(
    DEFAULT_PLANNING_AUTOMATION_SETTINGS.slots.map(slot => [slot.id, slot.time, slot.enabled]),
    [
      ["initial", "06:00", true],
      ["replan_1", "08:00", true],
      ["replan_2", "12:00", true],
      ["replan_3", "16:00", true],
    ],
  );
});

test("normalizes missing planning config without losing safe defaults", () => {
  const normalized = normalizePlanningAutomationSettings(undefined);
  assert.equal(normalized.enabled, true);
  assert.equal(normalized.readiness_retry_minutes, 5);
  assert.equal(normalized.readiness_timeout_minutes, 30);
  assert.equal(validatePlanningAutomationSettings(normalized), null);
});

test("rejects duplicate or non-increasing active schedule times", () => {
  const duplicate = normalizePlanningAutomationSettings({
    enabled: true,
    slots: [
      { id: "initial", time: "06:00", enabled: true },
      { id: "replan_1", time: "08:00", enabled: true },
      { id: "replan_2", time: "08:00", enabled: true },
      { id: "replan_3", time: "16:00", enabled: true },
    ],
  });
  assert.match(validatePlanningAutomationSettings(duplicate) ?? "", /nie mogą się powtarzać/);

  const backwards = normalizePlanningAutomationSettings({
    enabled: true,
    slots: [
      { id: "initial", time: "06:00", enabled: true },
      { id: "replan_1", time: "12:00", enabled: true },
      { id: "replan_2", time: "10:00", enabled: true },
      { id: "replan_3", time: "16:00", enabled: true },
    ],
  });
  assert.match(validatePlanningAutomationSettings(backwards) ?? "", /rosnąco/);
});
