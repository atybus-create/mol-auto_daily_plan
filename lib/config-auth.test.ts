import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { signConfigEnvelope, verifyConfigEnvelope, type SignedConfigEnvelope } from "./config-auth.ts";

test("accepts a fresh signed getLatestPlan envelope", () => {
  process.env.MOL_SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
  const envelope: SignedConfigEnvelope = {
    action: "getLatestPlan",
    issued_at: Date.now(),
    payload: { date: "2026-11-11" },
  };

  assert.equal(verifyConfigEnvelope(envelope, signConfigEnvelope(envelope)), true);
});

test("rejects a modified latest-plan payload", () => {
  process.env.MOL_SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
  const envelope: SignedConfigEnvelope = {
    action: "getLatestPlan",
    issued_at: Date.now(),
    payload: { date: "2026-11-11" },
  };
  const signature = signConfigEnvelope(envelope);

  assert.equal(verifyConfigEnvelope({ ...envelope, payload: { date: "2026-11-12" } }, signature), false);
});


test("accepts a fresh signed savePlanning envelope", () => {
  process.env.MOL_SESSION_SECRET = "test-only-session-secret-with-at-least-32-characters";
  const envelope: SignedConfigEnvelope = {
    action: "savePlanning",
    issued_at: Date.now(),
    payload: {
      planning: {
        enabled: true,
        slots: [
          { id: "initial", time: "06:00", enabled: true },
          { id: "replan_1", time: "08:00", enabled: true },
          { id: "replan_2", time: "12:00", enabled: true },
          { id: "replan_3", time: "16:00", enabled: true },
        ],
        readiness_retry_minutes: 5,
        readiness_timeout_minutes: 30,
      },
      expected_version: 3,
    },
  };

  assert.equal(verifyConfigEnvelope(envelope, signConfigEnvelope(envelope)), true);
});
