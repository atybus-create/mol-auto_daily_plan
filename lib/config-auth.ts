import { createHmac, timingSafeEqual } from "node:crypto";

export type ConfigAction = "read" | "saveEmployee" | "saveNorms" | "readMorningOrders" | "readDayDemand";
export type SignedConfigEnvelope = {
  action: ConfigAction;
  issued_at: number;
  payload: Record<string, unknown>;
};

function secret() {
  const value = process.env.MOL_SESSION_SECRET ?? "";
  if (value.length < 32) throw new Error("Brak bezpiecznej konfiguracji sesji");
  return value;
}

function digest(envelope: SignedConfigEnvelope) {
  return createHmac("sha256", secret()).update(JSON.stringify(envelope)).digest("hex");
}

export function signConfigEnvelope(envelope: SignedConfigEnvelope) {
  return digest(envelope);
}

export function verifyConfigEnvelope(value: unknown, signature: unknown) {
  if (!value || typeof value !== "object" || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const envelope = value as SignedConfigEnvelope;
  if (!["read", "saveEmployee", "saveNorms", "readMorningOrders", "readDayDemand"].includes(envelope.action)) return false;
  if (!Number.isSafeInteger(envelope.issued_at) || Math.abs(Date.now() - envelope.issued_at) > 60_000) return false;
  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) return false;
  const expected = Buffer.from(digest(envelope), "hex");
  const incoming = Buffer.from(signature, "hex");
  return expected.length === incoming.length && timingSafeEqual(expected, incoming);
}
