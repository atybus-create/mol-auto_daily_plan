import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node strip-types runner uses explicit .ts extensions.
import { isQuarterTime, validOverrides, validPlanVersion, validRemoveIds } from "./plan-request-validation.ts";

const validOverride = {
  override_id: "manual_alina_1000_1100",
  employee_key: "alina",
  start: "10:00",
  end: "11:00",
  activity: "pick",
  locked: true,
  created_at: "2026-11-12T09:00:00+01:00",
  reason: "Korekta lidera",
};

test("accepts valid 15 minute slots and rejects impossible minutes", () => {
  assert.equal(isQuarterTime("09:00"), true);
  assert.equal(isQuarterTime("23:45"), true);
  for (const value of ["09:05", "09:10", "09:60", "24:00", "9:00", "12:30:00", "foo", null]) {
    assert.equal(isQuarterTime(value), false);
  }
});

test("accepts a valid manual override", () => {
  assert.equal(validOverrides([validOverride]), true);
  assert.equal(validOverrides([]), true);
});

test("rejects bad activity, employee and intervals", () => {
  assert.equal(validOverrides([{...validOverride, activity: "duty"}]), false);
  assert.equal(validOverrides([{...validOverride, employee_key: ""}]), false);
  assert.equal(validOverrides([{...validOverride, start: "11:00", end: "10:00"}]), false);
  assert.equal(validOverrides([{...validOverride, end: "11:05"}]), false);
});

test("rejects unbounded or malformed manual changes", () => {
  assert.equal(validOverrides("not an array"), false);
  assert.equal(validOverrides(new Array(51).fill(validOverride)), false);
  assert.equal(validOverrides([{...validOverride, reason: "x".repeat(241)}]), false);
  assert.equal(validOverrides([{...validOverride, locked: false}]), false);
  assert.equal(validOverrides([{...validOverride, created_at: "not a date"}]), false);
});

test("accepts zero revision for a plan not yet generated", () => {
  assert.equal(validPlanVersion(null, 0), true);
  assert.equal(validPlanVersion("plan_123", 1), true);
  assert.equal(validPlanVersion("plan_123", 20), true);
});

test("rejects missing, fractional or negative plan revision", () => {
  for (const revision of [undefined, null, "1", 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(validPlanVersion("plan_123", revision), false);
  }
  assert.equal(validPlanVersion(null, 1), false);
  assert.equal(validPlanVersion("", 1), false);
});

test("validates removal IDs", () => {
  assert.equal(validRemoveIds(["manual_123"]), true);
  assert.equal(validRemoveIds([]), true);
  assert.equal(validRemoveIds([""]), false);
  assert.equal(validRemoveIds([42]), false);
  assert.equal(validRemoveIds(new Array(51).fill("manual_123")), false);
});
