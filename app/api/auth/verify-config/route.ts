import { NextRequest, NextResponse } from "next/server";
import { verifyConfigEnvelope } from "@/lib/config-auth";

export const runtime = "nodejs";

const MAX_SIGNED_CONFIG_BODY_BYTES = 128 * 1024;

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_SIGNED_CONFIG_BODY_BYTES) {
      return NextResponse.json({ valid: false }, { status: 413 });
    }

    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_SIGNED_CONFIG_BODY_BYTES) {
      return NextResponse.json({ valid: false }, { status: 413 });
    }

    const body = JSON.parse(text) as { envelope?: unknown; signature?: unknown };
    return NextResponse.json(
      { valid: verifyConfigEnvelope(body.envelope, body.signature) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
