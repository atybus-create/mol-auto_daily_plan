import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { signConfigEnvelope, type SignedConfigEnvelope } from "@/lib/config-auth";

export const runtime = "nodejs";

const OLD_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-schedule";
const NEW_URL = "https://n8n.estyl.team/webhook/mol-auto-plan-schedule-secure-test";

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 400 });
  }

  const envelope: SignedConfigEnvelope = {
    action: "readSchedule",
    issued_at: Date.now(),
    payload: { date },
  };

  const [oldResponse, newResponse] = await Promise.all([
    fetch(OLD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(NEW_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, signature: signConfigEnvelope(envelope) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }),
  ]);

  const [oldText, newText] = await Promise.all([oldResponse.text(), newResponse.text()]);
  let oldData: unknown = null;
  let newData: unknown = null;
  try { oldData = JSON.parse(oldText); } catch {}
  try { newData = JSON.parse(newText); } catch {}

  const oldEmployees = oldData && typeof oldData === "object" && Array.isArray((oldData as { employees?: unknown }).employees)
    ? (oldData as { employees: unknown[] }).employees.length
    : null;
  const newEmployees = newData && typeof newData === "object" && Array.isArray((newData as { employees?: unknown }).employees)
    ? (newData as { employees: unknown[] }).employees.length
    : null;

  return NextResponse.json({
    ok: true,
    date,
    old_status: oldResponse.status,
    new_status: newResponse.status,
    old_employees: oldEmployees,
    new_employees: newEmployees,
    equal: digest(oldData) === digest(newData),
    old_digest: digest(oldData).slice(0, 16),
    new_digest: digest(newData).slice(0, 16),
  }, { headers: { "Cache-Control": "no-store" } });
}
