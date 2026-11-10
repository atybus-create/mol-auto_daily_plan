import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";
import type { ExecutionSnapshotError, ExecutionSnapshotResponse } from "@/types/plan";

export const runtime = "nodejs";

const EXECUTION_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-execution";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "unauthorized", message: "Wymagane logowanie." } satisfies ExecutionSnapshotError, 401);
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return respond({ ok: false, error: "invalid_date", message: "Nieprawidłowa data." } satisfies ExecutionSnapshotError, 400);
  }

  try {
    const envelope: SignedConfigEnvelope = {
      action: "readExecution",
      issued_at: Date.now(),
      payload: { date },
    };

    const result = await fetch(EXECUTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const text = await result.text();
    let data: ExecutionSnapshotResponse | ExecutionSnapshotError;
    try {
      data = JSON.parse(text) as ExecutionSnapshotResponse | ExecutionSnapshotError;
    } catch {
      return respond({ ok: false, error: "invalid_backend_response", message: "Backend ES zwrócił nieprawidłową odpowiedź." } satisfies ExecutionSnapshotError, 502);
    }

    return respond(data, result.ok && data.ok ? 200 : (result.ok ? 502 : result.status));
  } catch {
    return respond({ ok: false, error: "execution_unavailable", message: "Dane wykonania ES są chwilowo niedostępne." } satisfies ExecutionSnapshotError, 502);
  }
}
