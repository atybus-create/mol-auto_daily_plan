import { NextRequest, NextResponse } from "next/server";

const N8N_SCHEDULE_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-schedule";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { date?: string };
    const date = String(body.date ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowa data.", employees: [] }, { status: 400 });
    }

    const response = await fetch(N8N_SCHEDULE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, {
      status: response.ok ? 200 : response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nie udało się pobrać grafiku z backendu.", employees: [] },
      { status: 502 },
    );
  }
}
