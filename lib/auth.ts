import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "mol_plan_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  exp: number;
  version: 1;
};

function getSessionSecret() {
  return process.env.MOL_SESSION_SECRET?.trim() ?? "";
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthConfigured() {
  return Boolean(process.env.MOL_APP_PASSWORD_HASH?.trim() && getSessionSecret().length >= 32);
}

export function verifyPasswordHash(candidateHash: string) {
  const configuredHash = process.env.MOL_APP_PASSWORD_HASH?.trim().toLowerCase() ?? "";
  return /^[a-f0-9]{64}$/.test(candidateHash) && /^[a-f0-9]{64}$/.test(configuredHash) && safeEqual(candidateHash, configuredHash);
}

export function createSessionToken(now = Date.now()) {
  const payload: SessionPayload = {
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    version: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token?: string) {
  if (!token || !isAuthConfigured()) return false;

  const [encodedPayload, signature, ...rest] = token.split(".");
  if (!encodedPayload || !signature || rest.length > 0 || !safeEqual(signature, sign(encodedPayload))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    return payload.version === 1 && typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
