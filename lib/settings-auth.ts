import { createHmac, timingSafeEqual } from "node:crypto";

export const SETTINGS_ACCESS_COOKIE_NAME = "mol_plan_settings_access";
export const SETTINGS_ACCESS_TTL_SECONDS = 60 * 60 * 2;

type SettingsAccessPayload = {
  exp: number;
  scope: "settings";
  version: 1;
};

export type SettingsPinVerification = "current" | "legacy" | false;

function sessionSecret() {
  const value = process.env.MOL_SESSION_SECRET?.trim() ?? "";
  if (value.length < 32) throw new Error("Brak bezpiecznej konfiguracji sesji");
  return value;
}

function settingsSecret() {
  const value = process.env.MOL_SETTINGS_SECRET?.trim() ?? "";
  return value.length >= 32 ? value : sessionSecret();
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeEqualText(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signWithSecret(payload: string, secret: string) {
  return createHmac("sha256", secret).update("settings-access:" + payload).digest("base64url");
}

function sign(payload: string) {
  return signWithSecret(payload, settingsSecret());
}

function pinDigestWithSecret(pin: string, secret: string) {
  return createHmac("sha256", secret).update("settings-pin:" + pin).digest("hex");
}

export function isValidSettingsPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export function settingsPinDigest(pin: string) {
  return pinDigestWithSecret(pin, settingsSecret());
}

export function verifySettingsPinSource(pin: string, storedDigest?: string | null): SettingsPinVerification {
  if (!isValidSettingsPin(pin)) return false;
  if (!storedDigest || !/^[a-f0-9]{64}$/.test(storedDigest)) return false;

  if (safeEqualHex(settingsPinDigest(pin), storedDigest)) return "current";

  const currentSecret = settingsSecret();
  const legacySecret = sessionSecret();
  if (currentSecret !== legacySecret && safeEqualHex(pinDigestWithSecret(pin, legacySecret), storedDigest)) {
    return "legacy";
  }

  return false;
}

export function verifySettingsPin(pin: string, storedDigest?: string | null) {
  return verifySettingsPinSource(pin, storedDigest) !== false;
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

  const currentExpected = sign(encoded);
  let signatureValid = safeEqualText(signature, currentExpected);

  if (!signatureValid) {
    const currentSecret = settingsSecret();
    const legacySecret = sessionSecret();
    if (currentSecret !== legacySecret) {
      signatureValid = safeEqualText(signature, signWithSecret(encoded, legacySecret));
    }
  }

  if (!signatureValid) return false;

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
