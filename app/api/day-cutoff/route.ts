import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { SETTINGS_ACCESS_COOKIE_NAME, verifySettingsAccessToken } from "@/lib/settings-auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";

export const runtime = "nodejs";

const CUTOFF_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-day-cutoff";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

async function forward(envelope: SignedConfigEnvelope) {
  const result = await fetch(CUTOFF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await result.text();
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { return respond({ ok: false, error: "invalid_backend_response", message: "Backend cut-offu zwrócił nieprawidłową odpowiedź." }, 502); }
  return respond(data, result.ok ? 200 : (result.status >= 400 && result.status < 500 ? result.status : 502));
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "unauthorized", message: "Wymagane logowanie." }, 401);
  }
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!validDate(date)) return respond({ ok: false, error: "invalid_input", message: "Nieprawidłowa data." }, 400);
  try {
    return await forward({ action: "readDayCutoff", issued_at: Date.now(), payload: { date } });
  } catch {
    return respond({ ok: false, error: "cutoff_unavailable", message: "Nie udało się odczytać skróconego cut-offu." }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "unauthorized", message: "Wymagane logowanie." }, 401);
  }
  if (!verifySettingsAccessToken(request.cookies.get(SETTINGS_ACCESS_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "forbidden", message: "Ustawienia są zablokowane. Wpisz PIN ponownie." }, 403);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return respond({ ok: false, error: "forbidden", message: "Niedozwolone pochodzenie żądania." }, 403);
  }
  try {
    const body = await request.json() as { date?: unknown; mode?: unknown; cutoff_local?: unknown };
    const date = typeof body.date === "string" ? body.date : "";
    const mode = body.mode === "SHORTENED" ? "SHORTENED" : body.mode === "STANDARD" ? "STANDARD" : "";
    const cutoff = typeof body.cutoff_local === "string" ? body.cutoff_local : null;
    if (!validDate(date) || !mode) return respond({ ok: false, error: "invalid_input", message: "Nieprawidłowe dane cut-offu." }, 400);
    return await forward({ action: "setDayCutoff", issued_at: Date.now(), payload: { date, mode, cutoff_local: cutoff } });
  } catch {
    return respond({ ok: false, error: "cutoff_unavailable", message: "Nie udało się zapisać skróconego cut-offu." }, 502);
  }
}
