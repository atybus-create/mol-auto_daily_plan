import { NextResponse } from "next/server";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";

export const runtime = "nodejs";

const N8N_SCHEDULE_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-schedule-secure-test";

export async function GET() {
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const envelope: SignedConfigEnvelope = {
    action: "readSchedule",
    issued_at: Date.now(),
    payload: { date: "2026-11-13" },
  };

  try {
    const response = await fetch(N8N_SCHEDULE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const data = await response.json() as { employees?: unknown[] };
    return NextResponse.json({
      ok: response.ok,
      backend_status: response.status,
      employee_count: Array.isArray(data.employees) ? data.employees.length : null,
    }, { status: response.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, backend_status: 0, employee_count: null }, { status: 502 });
  }
}
