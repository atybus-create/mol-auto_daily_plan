import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import { validateDayDemandSnapshot } from "@/lib/demand-utils";
import type { DayDemandError } from "@/types/plan";

export const runtime = "nodejs";

const UPSTREAM_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-day-demand";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function unavailable(error: string, status: number, businessDate?: string) {
  const data: DayDemandError = {
    ok: false,
    status: "unavailable",
    error,
    ...(businessDate ? { business_date: businessDate } : {}),
  };
  return respond(data, status);
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) return unavailable("Wymagane logowanie.", 401);

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return unavailable("Nieprawidłowa data.", 400);
  }

  const envelope: SignedConfigEnvelope = { action: "readDayDemand", issued_at: Date.now(), payload: { date } };

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.text();
    let result: unknown;
    try { result = JSON.parse(body); }
    catch { return unavailable("Backend prognozy zwrócił nieprawidłową odpowiedź.", 502, date); }

    if (!upstream.ok || !result || typeof result !== "object" || (result as { ok?: unknown }).ok !== true) {
      const message = result && typeof result === "object" && typeof (result as { error?: unknown }).error === "string"
        ? (result as { error: string }).error
        : "Nie udało się odczytać planu zamówień z backendu.";
      return unavailable(message, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, date);
    }

    const validation = validateDayDemandSnapshot(result, date);
    if (!validation.valid) {
      console.error("Invalid day-demand response", validation.errors);
      return unavailable("Backend zwrócił niekompletny plan zamówień.", 502, date);
    }
    return respond(result);
  } catch {
    return unavailable("Brak połączenia z prognozą zamówień.", 502, date);
  }
}
