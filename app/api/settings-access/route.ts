import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { signConfigEnvelope, type ConfigAction, type SignedConfigEnvelope } from "@/lib/config-auth";
import {
  createSettingsAccessToken,
  isValidSettingsPin,
  SETTINGS_ACCESS_COOKIE_NAME,
  SETTINGS_ACCESS_TTL_SECONDS,
  settingsPinDigest,
  verifySettingsAccessToken,
  verifySettingsPinSource,
} from "@/lib/settings-auth";

export const runtime = "nodejs";

const BACKEND = "https://n8n.estyl.team/webhook/mol-auto-plan-settings-access";

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function sessionAuthorized(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function backend(action: Extract<ConfigAction, "readSettingsPin" | "saveSettingsPin">, payload: Record<string, unknown>) {
  const envelope: SignedConfigEnvelope = { action, issued_at: Date.now(), payload };
  const signature = signConfigEnvelope(envelope);
  const result = await fetch(BACKEND, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope, signature }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await result.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error("Backend PIN zwrócił nieprawidłową odpowiedź."); }
  return { ok: result.ok && data.ok === true, status: result.status, data };
}

function setAccessCookie(res: NextResponse) {
  res.cookies.set({
    name: SETTINGS_ACCESS_COOKIE_NAME,
    value: createSettingsAccessToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SETTINGS_ACCESS_TTL_SECONDS,
    path: "/",
  });
  return res;
}

export async function GET(request: NextRequest) {
  if (!sessionAuthorized(request)) return response({ ok: false, error: "Wymagane logowanie." }, 401);
  return response({
    ok: true,
    unlocked: verifySettingsAccessToken(request.cookies.get(SETTINGS_ACCESS_COOKIE_NAME)?.value),
  });
}

export async function POST(request: NextRequest) {
  if (!sessionAuthorized(request)) return response({ ok: false, error: "Wymagane logowanie." }, 401);
  if (!sameOrigin(request)) return response({ ok: false, error: "Niedozwolone pochodzenie żądania." }, 403);

  try {
    const body = await request.json() as { pin?: unknown };
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    if (!isValidSettingsPin(pin)) return response({ ok: false, error: "PIN musi mieć od 4 do 8 cyfr." }, 400);

    const current = await backend("readSettingsPin", {});
    if (!current.ok) return response({ ok: false, error: String(current.data.error || "Nie udało się sprawdzić PIN-u.") }, current.status || 502);

    const storedDigest = typeof current.data.settings_pin_hash === "string" ? current.data.settings_pin_hash : "";
    const verification = verifySettingsPinSource(pin, storedDigest);
    if (!verification) {
      await new Promise(resolve => setTimeout(resolve, 450));
      return response({ ok: false, error: "Nieprawidłowy PIN." }, 401);
    }

    if (verification === "legacy") {
      const expectedVersion = Number(current.data.version);
      if (Number.isSafeInteger(expectedVersion)) {
        try {
          await backend("saveSettingsPin", {
            settings_pin_hash: settingsPinDigest(pin),
            expected_version: expectedVersion,
          });
        } catch {
          // Migration is best-effort. A valid PIN must still unlock settings.
        }
      }
    }

    return setAccessCookie(response({ ok: true, unlocked: true }));
  } catch {
    return response({ ok: false, error: "Nie udało się sprawdzić PIN-u ustawień." }, 502);
  }
}

export async function PUT(request: NextRequest) {
  if (!sessionAuthorized(request)) return response({ ok: false, error: "Wymagane logowanie." }, 401);
  if (!sameOrigin(request)) return response({ ok: false, error: "Niedozwolone pochodzenie żądania." }, 403);
  if (!verifySettingsAccessToken(request.cookies.get(SETTINGS_ACCESS_COOKIE_NAME)?.value)) {
    return response({ ok: false, error: "Dostęp do ustawień wygasł. Wpisz PIN ponownie." }, 403);
  }

  try {
    const body = await request.json() as { pin?: unknown; confirm_pin?: unknown; expected_version?: unknown };
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const confirm = typeof body.confirm_pin === "string" ? body.confirm_pin.trim() : "";
    if (!isValidSettingsPin(pin)) return response({ ok: false, error: "Nowy PIN musi mieć od 4 do 8 cyfr." }, 400);
    if (pin !== confirm) return response({ ok: false, error: "Wpisane PIN-y nie są takie same." }, 400);

    const result = await backend("saveSettingsPin", {
      settings_pin_hash: settingsPinDigest(pin),
      expected_version: body.expected_version,
    });
    if (!result.ok) return response({ ok: false, error: String(result.data.error || "Nie udało się zmienić PIN-u.") }, result.status || 502);

    return setAccessCookie(response({ ok: true, version: result.data.version }));
  } catch {
    return response({ ok: false, error: "Nie udało się zmienić PIN-u ustawień." }, 502);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sessionAuthorized(request)) return response({ ok: false, error: "Wymagane logowanie." }, 401);
  if (!sameOrigin(request)) return response({ ok: false, error: "Niedozwolone pochodzenie żądania." }, 403);

  const res = response({ ok: true, unlocked: false });
  res.cookies.set({
    name: SETTINGS_ACCESS_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
