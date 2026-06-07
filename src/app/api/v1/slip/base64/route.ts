import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { servePublicSlipVerify } from "@/lib/slip/serve-public";
import type { CheckCondition } from "@/lib/slip/conditions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

/**
 * POST /api/v1/slip/base64
 *
 * Slip2Go-compatible JSON shape:
 *   {
 *     "payload": {
 *       "imageBase64":     "data:image/jpeg;base64,/9j/..." | "/9j/...",
 *       "checkCondition":  CheckCondition (optional),
 *       "webhook":         true | false (optional)
 *     }
 *   }
 *
 * Accepts both data-URLs and raw base64. Mime type is inferred from the
 * data-URL prefix, defaulting to image/jpeg.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  let body: { payload?: { imageBase64?: string; checkCondition?: CheckCondition; webhook?: boolean } };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "BAD_JSON", detail: (e as Error).message },
      { status: 400 },
    );
  }

  const imageBase64 = body.payload?.imageBase64;
  if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELD", message: "payload.imageBase64 is required" },
      { status: 400 },
    );
  }

  // Split optional data-URL prefix: "data:image/png;base64,<b64>"
  let mimeType = "image/jpeg";
  let b64 = imageBase64.trim();
  const dataUrlMatch = b64.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    b64 = dataUrlMatch[2];
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "BAD_BASE64", detail: (e as Error).message },
      { status: 400 },
    );
  }
  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, error: "EMPTY_IMAGE" }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  return servePublicSlipVerify({
    auth,
    buffer,
    mimeType,
    conditions: body.payload?.checkCondition,
    fireWebhook: body.payload?.webhook === true,
    endpoint: "slip.base64",
    start,
  });
}
