import assert from "node:assert/strict";
import test from "node:test";
import { formatWarsawSourceTime } from "./live-update.ts";

test("formats source timestamps in Europe/Warsaw", () => {
  assert.equal(formatWarsawSourceTime("2026-11-17T12:30:00.000Z"), "13:30");
});

test("returns null for missing and invalid source timestamps", () => {
  assert.equal(formatWarsawSourceTime(null), null);
  assert.equal(formatWarsawSourceTime("not-a-date"), null);
});

