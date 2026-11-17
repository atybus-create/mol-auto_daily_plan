import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import type { ReportingError, ReportingPerformanceResponse } from "@/types/reporting";

export const runtime = "nodejs";

const REPORTING_PERFORMANCE_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-reporting-performance";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validRange(from: string, to: string) {
  if (!validDate(from) || !validDate(to) || from > to) return false;
  const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  return days <= 366;
}

function isPerformanceResponse(value: unknown, from: string, to: string): value is ReportingPerformanceResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<ReportingPerformanceResponse>;
  return response.ok === true && response.from === from && response.to === to && Array.isArray(response.rows) && Array.isArray(response.warnings);
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "unauthorized", message: "Wymagane logowanie." } satisfies ReportingError, 401);
  }

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!validRange(from, to)) {
    return respond({ ok: false, error: "invalid_range", message: "Zakres dat musi być poprawny i nie dłuższy niż 366 dni." } satisfies ReportingError, 400);
  }

  const envelope: SignedConfigEnvelope = { action: "readReportingPerformance", issued_at: Date.now(), payload: { from, to } };
  try {
    const result = await fetch(REPORTING_PERFORMANCE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await result.json() as unknown;
    if (!result.ok) return respond(data, result.status >= 400 && result.status < 500 ? result.status : 502);
    if (!isPerformanceResponse(data, from, to)) {
      return respond({ ok: false, error: "invalid_backend_response", message: "Raport wydajności zwrócił nieprawidłowe dane." } satisfies ReportingError, 502);
    }
    return respond(data);
  } catch {
    return respond({ ok: false, error: "reporting_unavailable", message: "Raport wydajności jest chwilowo niedostępny." } satisfies ReportingError, 502);
  }
}
