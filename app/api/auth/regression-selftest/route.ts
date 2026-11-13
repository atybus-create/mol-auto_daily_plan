import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { createSettingsAccessToken, SETTINGS_ACCESS_COOKIE_NAME, verifySettingsAccessToken } from "@/lib/settings-auth";
import { validateDayDemandSnapshot, validateOrdersDemandSnapshot } from "@/lib/demand-utils";

export const runtime = "nodejs";

type TestResult = { ok: boolean; status?: number; detail?: string };

function result(ok: boolean, status?: number, detail?: string): TestResult {
  return { ok, ...(status !== undefined ? { status } : {}), ...(detail ? { detail } : {}) };
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  const text = await response.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch {}
  return { response, body };
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const base = request.nextUrl.origin;
  const date = "2026-11-13";
  const session = createSessionToken();
  const settings = createSettingsAccessToken();
  const cookie = `${SESSION_COOKIE_NAME}=${session}; ${SETTINGS_ACCESS_COOKIE_NAME}=${settings}`;
  const sessionOnlyCookie = `${SESSION_COOKIE_NAME}=${session}`;
  const tests: Record<string, TestResult> = {};

  tests.sessionPrimitive = result(verifySessionToken(session), undefined, "create+verify session token");
  tests.settingsPrimitive = result(verifySettingsAccessToken(settings), undefined, "create+verify settings token");

  try {
    const r = await fetch(base + "/login", { redirect: "manual", cache: "no-store" });
    tests.loginPage = result(r.status === 200, r.status);
  } catch { tests.loginPage = result(false, 0); }

  try {
    const r = await fetch(base + "/", { redirect: "manual", cache: "no-store" });
    const location = r.headers.get("location") || "";
    tests.rootRequiresLogin = result([302,307,308].includes(r.status) && location.includes("/login"), r.status);
  } catch { tests.rootRequiresLogin = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "__regression_invalid_password__", returnTo: "/" }),
    });
    tests.invalidLoginRejected = result(response.status === 401, response.status);
  } catch { tests.invalidLoginRejected = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/config");
    tests.apiRequiresSession = result(response.status === 401, response.status);
  } catch { tests.apiRequiresSession = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + "/api/config", { headers: { Cookie: cookie } });
    const value = body as { ok?: unknown } | null;
    tests.configRead = result(response.status === 200 && value?.ok === true, response.status);
  } catch { tests.configRead = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + "/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date }),
    });
    const value = body as { ok?: unknown; employees?: unknown[] } | null;
    tests.scheduleRead = result(response.status === 200 && value?.ok === true && Array.isArray(value.employees), response.status,
      Array.isArray(value?.employees) ? `employees=${value.employees.length}` : undefined);
  } catch { tests.scheduleRead = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date: "bad-date" }),
    });
    tests.scheduleValidation = result(response.status === 400, response.status);
  } catch { tests.scheduleValidation = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + `/api/day-demand?date=${date}`, { headers: { Cookie: cookie } });
    const validation = validateDayDemandSnapshot(body, date);
    tests.dayDemandRead = result(response.status === 200 && validation.valid, response.status,
      validation.valid ? undefined : `validation_errors=${validation.errors.length}`);
  } catch { tests.dayDemandRead = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + `/api/orders?date=${date}`, { headers: { Cookie: cookie } });
    const validation = validateOrdersDemandSnapshot(body, date);
    tests.ordersRead = result(response.status === 200 && validation.valid, response.status,
      validation.valid ? undefined : `validation_errors=${validation.errors.length}`);
  } catch { tests.ordersRead = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + `/api/execution?date=${date}`, { headers: { Cookie: cookie } });
    const value = body as { ok?: unknown; business_date?: unknown; warnings?: unknown } | null;
    tests.executionRead = result(
      response.status === 200 && value?.ok === true && value.business_date === date && Array.isArray(value.warnings),
      response.status,
    );
  } catch { tests.executionRead = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + `/api/morning-orders?date=${date}`, { headers: { Cookie: cookie } });
    const value = body as { ok?: unknown } | null;
    tests.morningOrdersRead = result(response.status === 200 && value?.ok === true, response.status);
  } catch { tests.morningOrdersRead = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + `/api/plan?date=${date}`, { headers: { Cookie: cookie } });
    const value = body as { ok?: unknown; business_date?: unknown; plan?: unknown } | null;
    tests.latestPlanRead = result(
      response.status === 200 && value?.ok === true && value.business_date === date
        && (value.plan === null || typeof value.plan === "object"),
      response.status,
    );
  } catch { tests.latestPlanRead = result(false, 0); }

  try {
    const { response, body } = await jsonFetch(base + "/api/settings-access", { headers: { Cookie: cookie } });
    const value = body as { ok?: unknown; unlocked?: unknown } | null;
    tests.settingsAccess = result(response.status === 200 && value?.ok === true && value.unlocked === true, response.status);
  } catch { tests.settingsAccess = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionOnlyCookie },
      body: JSON.stringify({ action: "saveNorms", norms: {} }),
    });
    tests.configWriteNeedsSettingsUnlock = result(response.status === 403, response.status);
  } catch { tests.configWriteNeedsSettingsUnlock = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "https://example.invalid" },
      body: JSON.stringify({ action: "saveNorms", norms: {} }),
    });
    tests.configWriteOriginGuard = result(response.status === 403, response.status);
  } catch { tests.configWriteOriginGuard = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ date, demand: null }),
    });
    tests.planWriteValidation = result(response.status === 400, response.status);
  } catch { tests.planWriteValidation = result(false, 0); }

  try {
    const { response } = await jsonFetch(base + "/api/settings-access", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: sessionOnlyCookie },
      body: JSON.stringify({ pin: "1234", confirm_pin: "1234", expected_version: -1 }),
    });
    tests.settingsWriteNeedsUnlock = result(response.status === 403, response.status);
  } catch { tests.settingsWriteNeedsUnlock = result(false, 0); }

  try {
    const r = await fetch(base + "/login", { cache: "no-store" });
    const csp = r.headers.get("content-security-policy-report-only") || "";
    tests.securityHeaders = result(
      r.headers.get("x-frame-options") === "DENY"
        && r.headers.get("x-content-type-options") === "nosniff"
        && csp.includes("default-src 'self'"),
      r.status,
    );
  } catch { tests.securityHeaders = result(false, 0); }

  const passed = Object.values(tests).filter(item => item.ok).length;
  const failed = Object.keys(tests).length - passed;

  return NextResponse.json({
    ok: failed === 0,
    date,
    summary: { passed, failed, total: Object.keys(tests).length },
    tests,
  }, {
    status: failed === 0 ? 200 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}
