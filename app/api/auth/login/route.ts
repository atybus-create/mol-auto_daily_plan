import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  isAuthConfigured,
  safeReturnPath,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  verifyPasswordHash,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Logowanie nie zostało jeszcze skonfigurowane." },
      { status: 503 },
    );
  }

  let body: { password?: unknown; returnTo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nie udało się odczytać formularza." }, { status: 400 });
  }

  const candidateHash = typeof body.password === "string"
    ? createHash("sha256").update(body.password).digest("hex")
    : "";

  if (!verifyPasswordHash(candidateHash)) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return NextResponse.json({ error: "Nieprawidłowe hasło. Spróbuj ponownie." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, returnTo: safeReturnPath(body.returnTo) });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
