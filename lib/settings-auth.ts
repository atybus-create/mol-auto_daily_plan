import { createHmac, timingSafeEqual } from "node:crypto";

export const SETTINGS_ACCESS_COOKIE_NAME = "mol_plan_settings_access";
export const SETTINGS_ACCESS_TTL_SECONDS = 60 * 60 * 2;

type SettingsAccessPayload = {
  exp: number;
  scope: "settings";
  version: 1;
};

function secret() {
  const value = process.env.MOL_SESSION_SECRET?.trim() ?? "";
  if (value.length < 32) throw new Error("Brak bezpiecznej konfiguracji sesji");
  return value;
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update("settings-access:" + payload).digest("base64url");
}

export function isValidSettingsPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export function settingsPinDigest(pin: string) {
  return createHmac("sha256", secret()).update("settings-pin:" + pin).digest("hex");
}

export function defaultSettingsPinDigest() {
  return settingsPinDigest("2026");
}

export function verifySettingsPin(pin: string, storedDigest?: string | null) {
  if (!isValidSettingsPin(pin)) return false;
  const expected = storedDigest && /^[a-f0-9]{64}$/.test(storedDigest)
    ? storedDigest
    : defaultSettingsPinDigest();
  return safeEqualHex(settingsPinDigest(pin), expected);
}

export function createSettingsAccessToken(now = Date.now()) {
  const payload: SettingsAccessPayload = {
    exp: Math.floor(now / 1000) + SETTINGS_ACCESS_TTL_SECONDS,
    scope: "settings",
    version: 1,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySettingsAccessToken(token?: string) {
  if (!token) return false;
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return false;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SettingsAccessPayload>;
    return payload.version === 1
      && payload.scope === "settings"
      && typeof payload.exp === "number"
      && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
