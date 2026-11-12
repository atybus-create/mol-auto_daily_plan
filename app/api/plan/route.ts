import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import type { GeneratedPlanError, GeneratedPlanResponse, LatestGeneratedPlanResponse, OrdersDemandSnapshot } from "@/types/plan";

export const runtime = "nodejs";

const PLAN_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-generate";
const LATEST_PLAN_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-latest";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}


const ACTIVITIES = new Set(["pick", "pack", "presence", "clean", "returns", "break"]);
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isQuarterTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute < 60 && minute % 15 === 0;
}
function validOverrides(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 50 && value.every(item =>
    isRecord(item) &&
    typeof item.override_id === "string" && item.override_id.length > 0 && item.override_id.length <= 160 &&
    typeof item.employee_key === "string" && item.employee_key.length > 0 && item.employee_key.length <= 160 &&
    isQuarterTime(item.start) && isQuarterTime(item.end) && item.start < item.end &&
    typeof item.activity === "string" && ACTIVITIES.has(item.activity) &&
    item.locked === true &&
    typeof item.created_at === "string" && !Number.isNaN(Date.parse(item.created_at)) &&
    typeof item.reason === "string" && item.reason.length <= 240
  );
}
function isPlanError(value: unknown): value is GeneratedPlanError {
  return isRecord(value) && value.ok === false &&
    typeof value.error === "string" &&
    (value.message === undefined || typeof value.message === "string");
}
function invalidResponse(message: string) {
  return respond({ ok: false, error: "invalid_backend_response", message } satisfies GeneratedPlanError, 502);
}

function isGeneratedPlan(value: unknown, date: string): value is GeneratedPlanResponse {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<GeneratedPlanResponse>;
  return plan.ok === true
    && plan.business_date === date
    && typeof plan.plan_id === "string"
    && typeof plan.generated_at === "string"
    && typeof plan.planning_from === "string"
    && (plan.status === "DRAFT_READY" || plan.status === "CAPACITY_SHORTAGE")
    && Boolean(plan.summary && typeof plan.summary === "object")
    && Array.isArray(plan.shortages)
    && Array.isArray(plan.employees);
}

function isLatestPlanResponse(value: unknown, date: string): value is LatestGeneratedPlanResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<LatestGeneratedPlanResponse>;
  return response.ok === true
    && response.business_date === date
    && (response.plan === null || isGeneratedPlan(response.plan, date))
    && (response.current === null || Boolean(response.current && typeof response.current === "object"))
    && (response.history === null || Boolean(response.history && typeof response.history === "object"));
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "unauthorized", message: "Wymagane logowanie." } satisfies GeneratedPlanError, 401);
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!validDate(date)) {
    return respond({ ok: false, error: "invalid_input", message: "Nieprawidłowa data." } satisfies GeneratedPlanError, 400);
  }

  const envelope: SignedConfigEnvelope = { action: "getLatestPlan", issued_at: Date.now(), payload: { date } };

  try {
    const result = await fetch(LATEST_PLAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const text = await result.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return respond({ ok: false, error: "invalid_backend_response", message: "Odczyt planu zwrócił nieprawidłową odpowiedź." } satisfies GeneratedPlanError, 502);
    }

    if (!result.ok) {
      return respond(data, result.status >= 400 && result.status < 500 ? result.status : 502);
    }
    if (!isLatestPlanResponse(data, date)) {
      return respond({ ok: false, error: "invalid_backend_response", message: "Zapisany plan jest niekompletny." } satisfies GeneratedPlanError, 502);
    }
    return respond(data);
  } catch {
    return respond({ ok: false, error: "planner_unavailable", message: "Nie udało się odczytać zapisanego planu." } satisfies GeneratedPlanError, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    const body: GeneratedPlanError = { ok: false, error: "unauthorized", message: "Wymagane logowanie." };
    return respond(body, 401);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    const body: GeneratedPlanError = { ok: false, error: "forbidden", message: "Niedozwolone pochodzenie żądania." };
    return respond(body, 403);
  }

  try {
    const body = await request.json() as {
      date?: unknown;
      demand?: unknown;
      trigger?: unknown;
      trigger_ref?: unknown;
      manual_overrides?: unknown;
      remove_override_ids?: unknown;
      expected_plan_id?: unknown;
      expected_revision?: unknown;
    };
    const date = typeof body.date === "string" ? body.date : "";
    const demand = body.demand as OrdersDemandSnapshot | undefined;
    const trigger = body.trigger === "MANUAL" ? "MANUAL" : "BUTTON";
    const triggerRef = typeof body.trigger_ref === "string" ? body.trigger_ref.slice(0, 120) : "";
    const manualOverrides = body.manual_overrides ?? [];
    const removeOverrideIds = body.remove_override_ids ?? [];
    const hasExpectedId = Object.prototype.hasOwnProperty.call(body, "expected_plan_id");
    const hasExpectedRevision = Object.prototype.hasOwnProperty.call(body, "expected_revision");
    const expectedPlanId = body.expected_plan_id;
    const expectedRevision = body.expected_revision;
    if (!validOverrides(manualOverrides) ||
      !Array.isArray(removeOverrideIds) || removeOverrideIds.length > 50 ||
      !removeOverrideIds.every(id => typeof id === "string" && id.length > 0 && id.length <= 160) ||
      !hasExpectedId || !hasExpectedRevision ||
      !(expectedPlanId === null || (typeof expectedPlanId === "string" && expectedPlanId.length > 0 && expectedPlanId.length <= 160)) ||
      !(typeof expectedRevision === "number" && Number.isSafeInteger(expectedRevision) && expectedRevision >= 0) ||
      (expectedPlanId === null && expectedRevision !== 0) ||
      (trigger === "MANUAL" && Array.isArray(manualOverrides) && manualOverrides.length === 0 && Array.isArray(removeOverrideIds) && removeOverrideIds.length === 0)
    ) {
      return respond({ ok: false, error: "invalid_input", message: "Nieprawidłowe dane korekty lub brak aktualnej wersji planu. Odśwież plan." } satisfies GeneratedPlanError, 400);
    }

    if (!validDate(date) || !demand || demand.ok !== true || demand.business_date !== date || demand.status !== "ready") {
      const error: GeneratedPlanError = { ok: false, error: "invalid_input", message: "Plan można wygenerować tylko dla kompletnego DAY DEMAND." };
      return respond(error, 400);
    }

    const envelope: SignedConfigEnvelope = {
      action: "generatePlan",
      issued_at: Date.now(),
      payload: {
        date,
        demand: {
          ok: true,
          business_date: demand.business_date,
          status: demand.status,
          corrected_required_today: "corrected_required_today" in demand ? demand.corrected_required_today : demand.required_today,
          required_today: demand.required_today,
          generated_at: demand.generated_at,
        },
        trigger,
        trigger_ref: triggerRef,
        manual_overrides: manualOverrides,
        remove_override_ids: removeOverrideIds,
        expected_plan_id: expectedPlanId,
        expected_revision: expectedRevision,
      },
    };

    const result = await fetch(PLAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const text = await result.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return invalidResponse("Generator zwrócił nieprawidłową odpowiedź.");
    }
    if (!result.ok) {
      if (result.status >= 400 && result.status < 500 && isPlanError(data)) {
        return respond(data, result.status);
      }
      return invalidResponse("Generator nie zwrócił poprawnego komunikatu błędu.");
    }
    if (!isGeneratedPlan(data, date)) {
      return invalidResponse("Generator zwrócił niekompletny plan.");
    }
    return respond(data);
  } catch {
    return respond({ ok: false, error: "planner_unavailable", message: "Generator planu jest chwilowo niedostępny." } satisfies GeneratedPlanError, 502);
  }
}
