import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type ConfigAction, type SignedConfigEnvelope } from "@/lib/config-auth";
import { SETTINGS_ACCESS_COOKIE_NAME, verifySettingsAccessToken } from "@/lib/settings-auth";

export const runtime = "nodejs";

const ROOT = "https://n8n.estyl.team/webhook/";
type MutableConfigAction = Exclude<ConfigAction, "readMorningOrders" | "readDayDemand" | "readExecution" | "generatePlan" | "getLatestPlan">;

const PATHS: Record<MutableConfigAction, string> = {
  read: "mol-auto-plan-config-read",
  saveEmployee: "mol-auto-plan-config-employee",
  saveNorms: "mol-auto-plan-config-norms",
  savePlanning: "mol-auto-plan-config-planning",
};

function authorized(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function forward(action: MutableConfigAction, payload: Record<string, unknown>) {
  const envelope: SignedConfigEnvelope = { action, issued_at: Date.now(), payload };
  const signature = signConfigEnvelope(envelope);
  const result = await fetch(ROOT + PATHS[action], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope, signature }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const content = await result.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(content) as Record<string, unknown>; }
  catch { return response({ ok: false, error: "Backend zwrócił nieprawidłową odpowiedź." }, 502); }
  return response(data, result.ok && data.ok === true ? 200 : (result.ok ? 502 : result.status));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return response({ ok: false, error: "Wymagane logowanie." }, 401);
  try { return await forward("read", {}); }
  catch { return response({ ok: false, error: "Backend ustawień jest niedostępny." }, 502); }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return response({ ok: false, error: "Wymagane logowanie." }, 401);
  if (!verifySettingsAccessToken(request.cookies.get(SETTINGS_ACCESS_COOKIE_NAME)?.value)) {
    return response({ ok: false, error: "Ustawienia są zablokowane. Wpisz PIN ponownie." }, 403);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return response({ ok: false, error: "Niedozwolone pochodzenie żądania." }, 403);
  try {
    const body = await request.json() as { action?: unknown; profile?: unknown; norms?: unknown; planning?: unknown; expected_version?: unknown };
    if (body.action === "saveEmployee" && body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)) {
      return await forward("saveEmployee", body.profile as Record<string, unknown>);
    }
    if (body.action === "saveNorms" && body.norms && typeof body.norms === "object" && !Array.isArray(body.norms)) {
      return await forward("saveNorms", { norms: body.norms as Record<string, unknown>, expected_version: body.expected_version });
    }
    if (body.action === "savePlanning" && body.planning && typeof body.planning === "object" && !Array.isArray(body.planning)) {
      return await forward("savePlanning", { planning: body.planning as Record<string, unknown>, expected_version: body.expected_version });
    }
    return response({ ok: false, error: "Nieprawidłowa operacja." }, 400);
  } catch {
    return response({ ok: false, error: "Nie udało się zapisać konfiguracji." }, 502);
  }
}
