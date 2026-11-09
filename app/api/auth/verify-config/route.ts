import { NextRequest, NextResponse } from "next/server";
import { verifyConfigEnvelope } from "@/lib/config-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (text.length > 16_384) return NextResponse.json({ valid: false }, { status: 413 });
    const body = JSON.parse(text) as { envelope?: unknown; signature?: unknown };
    return NextResponse.json({ valid: verifyConfigEnvelope(body.envelope, body.signature) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
