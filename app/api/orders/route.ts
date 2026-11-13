import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import { validateDayDemandSnapshot, validateOrdersDemandSnapshot } from "@/lib/demand-utils";
import type { DayDemandError, OrdersDemandResponse } from "@/types/plan";

export const runtime = "nodejs";

const V3_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-day-demand-v3";
const V2_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-day-demand-v2";
const V1_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-day-demand";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function unavailable(error: string, status: number, businessDate?: string) {
  const data: DayDemandError = { ok: false, status: "unavailable", error, ...(businessDate ? { business_date: businessDate } : {}) };
  return respond(data, status);
}

async function callUpstream(url: string, date: string) {
  const envelope: SignedConfigEnvelope = { action: "readDayDemand", issued_at: Date.now(), payload: { date } };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body: unknown;
  try { body = JSON.parse(text); }
  catch { throw new Error("invalid_json"); }
  return { response, body };
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) return unavailable("Wymagane logowanie.", 401);

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return unavailable("Nieprawidłowa data.", 400);
  }

  try {
    const v3 = await callUpstream(V3_URL, date);
    if (v3.response.ok && v3.body && typeof v3.body === "object" && (v3.body as { ok?: unknown }).ok === true) {
      const validation = validateOrdersDemandSnapshot(v3.body, date);
      if (validation.valid) return respond(v3.body as OrdersDemandResponse);
      console.error("Invalid orders V3 response", validation.errors);
    }
  } catch (error) {
    console.error("Orders V3 unavailable, using V2 fallback", error);
  }

  try {
    const v2 = await callUpstream(V2_URL, date);
    if (v2.response.ok && v2.body && typeof v2.body === "object" && (v2.body as { ok?: unknown }).ok === true) {
      const validation = validateOrdersDemandSnapshot(v2.body, date);
      if (validation.valid) return respond(v2.body as OrdersDemandResponse);
      console.error("Invalid orders V2 response", validation.errors);
    }
  } catch (error) {
    console.error("Orders V2 unavailable, using V1 fallback", error);
  }

  try {
    const v1 = await callUpstream(V1_URL, date);
    if (!v1.response.ok || !v1.body || typeof v1.body !== "object" || (v1.body as { ok?: unknown }).ok !== true) {
      return unavailable("Nie udało się odczytać planu zamówień.", 502, date);
    }
    const validation = validateDayDemandSnapshot(v1.body, date);
    if (!validation.valid) {
      console.error("Invalid orders V1 fallback response", validation.errors);
      return unavailable("Backend zwrócił niekompletny plan zamówień.", 502, date);
    }
    const fallback = v1.body as Record<string, unknown>;
    const warnings = Array.isArray(fallback.warnings) ? fallback.warnings.filter(item => typeof item === "string") : [];
    return respond({ ...fallback, warnings: [...warnings, "Tryb awaryjny: korekta realnym spływem jest chwilowo niedostępna."] });
  } catch {
    return unavailable("Brak połączenia z planem zamówień.", 502, date);
  }
}
