import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { createSettingsAccessToken, defaultSettingsPinDigest, isValidSettingsPin, settingsPinDigest, verifySettingsAccessToken, verifySettingsPin } from "./settings-auth.ts";

const secret = "test-only-session-secret-with-at-least-32-characters";

test("uses 2026 as the default settings PIN when no hash is stored", () => {
  process.env.MOL_SESSION_SECRET = secret;
  assert.equal(verifySettingsPin("2026", ""), true);
  assert.equal(verifySettingsPin("2025", ""), false);
  assert.equal(defaultSettingsPinDigest(), settingsPinDigest("2026"));
});

test("accepts only 4 to 8 digit PINs", () => {
  assert.equal(isValidSettingsPin("1234"), true);
  assert.equal(isValidSettingsPin("12345678"), true);
  assert.equal(isValidSettingsPin("123"), false);
  assert.equal(isValidSettingsPin("123456789"), false);
  assert.equal(isValidSettingsPin("12a4"), false);
});

test("verifies a stored changed PIN hash", () => {
  process.env.MOL_SESSION_SECRET = secret;
  const stored = settingsPinDigest("4815");
  assert.equal(verifySettingsPin("4815", stored), true);
  assert.equal(verifySettingsPin("2026", stored), false);
});

test("creates a valid short-lived settings access token", () => {
  process.env.MOL_SESSION_SECRET = secret;
  const token = createSettingsAccessToken(Date.now());
  assert.equal(verifySettingsAccessToken(token), true);
  assert.equal(verifySettingsAccessToken(token + "x"), false);
});
