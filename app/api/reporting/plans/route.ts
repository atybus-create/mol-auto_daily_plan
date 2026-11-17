import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import type { ReportingError, ReportingPlansResponse } from "@/types/reporting";

export const runtime = "nodejs";

const REPORTING_PLANS_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-reporting-plans";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isPlansResponse(value: unknown, date: string): value is ReportingPlansResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<ReportingPlansResponse>;
  return response.ok === true && response.business_date === date && Array.isArray(response.versions);
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "unauthorized", message: "Wymagane logowanie." } satisfies ReportingError, 401);
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!validDate(date)) {
    return respond({ ok: false, error: "invalid_date", message: "Nieprawidłowa data." } satisfies ReportingError, 400);
  }

  const envelope: SignedConfigEnvelope = { action: "readReportingPlans", issued_at: Date.now(), payload: { date } };
  try {
    const result = await fetch(REPORTING_PLANS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await result.json() as unknown;
    if (!result.ok) return respond(data, result.status >= 400 && result.status < 500 ? result.status : 502);
    if (!isPlansResponse(data, date)) {
      return respond({ ok: false, error: "invalid_backend_response", message: "Historia planów zwróciła nieprawidłowe dane." } satisfies ReportingError, 502);
    }
    return respond(data);
  } catch {
    return respond({ ok: false, error: "reporting_unavailable", message: "Historia planów jest chwilowo niedostępna." } satisfies ReportingError, 502);
  }
}
