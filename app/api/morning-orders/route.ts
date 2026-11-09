import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";

export const runtime = "nodejs";

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  if (!verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return respond({ ok: false, error: "Wymagane logowanie." }, 401);
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z"))) {
    return respond({ ok: false, error: "Nieprawidłowa data." }, 400);
  }

  const envelope: SignedConfigEnvelope = {
    action: "readMorningOrders",
    issued_at: Date.now(),
    payload: { date },
  };

  try {
    const upstream = await fetch("https://n8n.estyl.team/webhook/mol-auto-plan-morning-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    const result = await upstream.json() as { ok?: boolean; error?: string };
    if (!upstream.ok || result.ok !== true) {
      return respond({
        ok: false,
        error: result.error || "Nie udało się odczytać zamówień z backendu.",
      }, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502);
    }

    return respond(result);
  } catch {
    return respond({ ok: false, error: "Brak połączenia z danymi zamówień." }, 502);
  }
}
