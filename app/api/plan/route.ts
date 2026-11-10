import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import type { GeneratedPlanError, GeneratedPlanResponse, OrdersDemandSnapshot } from "@/types/plan";

export const runtime = "nodejs";

const PLAN_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-generate";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
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
    const body = await request.json() as { date?: unknown; demand?: unknown };
    const date = typeof body.date === "string" ? body.date : "";
    const demand = body.demand as OrdersDemandSnapshot | undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !demand || demand.ok !== true || demand.business_date !== date || demand.status !== "ready") {
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
    let data: GeneratedPlanResponse | GeneratedPlanError;
    try {
      data = JSON.parse(text) as GeneratedPlanResponse | GeneratedPlanError;
    } catch {
      return respond({ ok: false, error: "invalid_backend_response", message: "Generator zwrócił nieprawidłową odpowiedź." } satisfies GeneratedPlanError, 502);
    }

    return respond(data, result.ok && data.ok ? 200 : (result.ok ? 502 : result.status));
  } catch {
    return respond({ ok: false, error: "planner_unavailable", message: "Generator planu jest chwilowo niedostępny." } satisfies GeneratedPlanError, 502);
  }
}
