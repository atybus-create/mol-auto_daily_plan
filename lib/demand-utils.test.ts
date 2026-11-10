import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { FORECAST_SLOT_STARTS, expectedSlotEnd, grossPlan, validateDayDemandSnapshot } from "./demand-utils.ts";

test("creates exactly 20 half-hour slots from 06:00 to 16:00", () => {
  assert.equal(FORECAST_SLOT_STARTS.length, 20);
  assert.equal(FORECAST_SLOT_STARTS[0], "06:00");
  assert.equal(FORECAST_SLOT_STARTS.at(-1), "15:30");
  assert.equal(expectedSlotEnd(FORECAST_SLOT_STARTS.at(-1)!), "16:00");
});

test("does not turn missing forecast into zero", () => {
  assert.equal(grossPlan({ pl: 2, under: 3, total: 5 }, null), null);
});

test("accepts a consistent ready snapshot and rejects a missing slot", () => {
  const morning = { pl: 10, under: 20, total: 30 };
  const forecast = { pl: 20, under: 80, total: 100, p10: 80, p90: 120 };
  const slots = FORECAST_SLOT_STARTS.map((slot_start, index) => ({
    slot_start,
    slot_end: expectedSlotEnd(slot_start)!,
    forecast: { pl: 1, under: 4, total: 5, p10: 4, p90: 6 },
    cumulative_forecast: (index + 1) * 5,
    cumulative_plan_gross: 30 + (index + 1) * 5,
    eligible_today: 5,
    after_cutoff: 0,
    by_carrier: [{
      group: "other",
      point: 5,
      p10: 4,
      p90: 6,
      eligible_today: 5,
      after_cutoff: 0,
      eligibility: "eligible",
      cutoff_local: "12:00",
    }],
  }));
  const snapshot = {
    ok: true,
    business_date: "2026-11-10",
    timezone: "Europe/Warsaw",
    generated_at: "2026-11-10T05:30:00+01:00",
    source_as_of: "2026-11-10T06:00:00+01:00",
    model_version: "test",
    trained_until: "2026-11-08",
    forecast_run_id: "test-run",
    forecast_kind: "DAILY_BASELINE",
    status: "ready",
    quality: "medium",
    morning,
    forecast,
    plan_gross: { pl: 30, under: 100, total: 130 },
    required_today: 130,
    after_cutoff: 0,
    slots,
    warnings: [],
  };
  assert.deepEqual(validateDayDemandSnapshot(snapshot, "2026-11-10"), { valid: true, errors: [] });
  assert.equal(validateDayDemandSnapshot({ ...snapshot, slots: slots.slice(1) }).valid, false);
});
