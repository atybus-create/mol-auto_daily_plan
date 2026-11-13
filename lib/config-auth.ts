import { createHmac, timingSafeEqual } from "node:crypto";

export type ConfigAction = "read" | "saveEmployee" | "saveNorms" | "savePlanning" | "readSettingsPin" | "saveSettingsPin" | "readMorningOrders" | "readDayDemand" | "readExecution" | "readSchedule" | "generatePlan" | "getLatestPlan";
export type SignedConfigEnvelope = {
  action: ConfigAction;
  issued_at: number;
  payload: Record<string, unknown>;
};

function sessionSecret() {
  const value = process.env.MOL_SESSION_SECRET ?? "";
  if (value.length < 32) throw new Error("Brak bezpiecznej konfiguracji sesji");
  return value;
}

function backendSigningSecret() {
  const value = process.env.MOL_BACKEND_SIGNING_SECRET?.trim() ?? "";
  return value.length >= 32 ? value : sessionSecret();
}

function digest(envelope: SignedConfigEnvelope, secret: string) {
  return createHmac("sha256", secret).update(JSON.stringify(envelope)).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signConfigEnvelope(envelope: SignedConfigEnvelope) {
  return digest(envelope, backendSigningSecret());
}

export function verifyConfigEnvelope(value: unknown, signature: unknown) {
  if (!value || typeof value !== "object" || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const envelope = value as SignedConfigEnvelope;
  if (!["read", "saveEmployee", "saveNorms", "savePlanning", "readSettingsPin", "saveSettingsPin", "readMorningOrders", "readDayDemand", "readExecution", "readSchedule", "generatePlan", "getLatestPlan"].includes(envelope.action)) return false;
  if (!Number.isSafeInteger(envelope.issued_at) || Math.abs(Date.now() - envelope.issued_at) > 60_000) return false;
  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) return false;

  const current = digest(envelope, backendSigningSecret());
  if (safeEqualHex(signature, current)) return true;

  const legacy = digest(envelope, sessionSecret());
  return current !== legacy && safeEqualHex(signature, legacy);
}
