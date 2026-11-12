import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { normalizeManualOverrideInput } from "./manual-overrides.ts";

test("normalizes a valid 15-minute manual correction", () => {
  const value = normalizeManualOverrideInput({
    employee_key: "alina",
    start: "11:00",
    end: "12:00",
    activity: "pack",
    reason: "Wsparcie PAK",
  });
  assert.equal(value.employee_key, "alina");
  assert.equal(value.activity, "pack");
  assert.equal(value.locked, true);
  assert.equal(value.start, "11:00");
  assert.equal(value.end, "12:00");
});

test("rejects corrections outside the 15-minute grid", () => {
  assert.throws(() => normalizeManualOverrideInput({
    employee_key: "alina",
    start: "11:05",
    end: "12:00",
    activity: "pack",
  }), /15-minutowy/);
});

test("does not allow manual duty blocks", () => {
  assert.throws(() => normalizeManualOverrideInput({
    employee_key: "alina",
    start: "11:00",
    end: "12:00",
    activity: "duty",
  }), /Niedozwolona/);
});
