import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { servePublicSlipVerify } from "@/lib/slip/serve-public";
import type { CheckCondition } from "@/lib/slip/conditions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

/**
 * POST /api/v1/slip/url
 *
 * Slip2Go-compatible JSON shape:
 *   {
 *     "payload": {
 *       "imageUrl":        "https://...slip.jpg",
 *       "checkCondition":  CheckCondition (optional),
 *       "webhook":         true | false (optional)
 *     }
 *   }
 *
 * SSRF-safe-ish: only http/https schemes, 10s timeout, 8MB cap. We rely on
 * the customer to host their own slip image; we don't deref private IPs in
 * this iteration — keep it behind WAF/egress rules if that's a concern.
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  let body: { payload?: { imageUrl?: string; checkCondition?: CheckCondition; webhook?: boolean } };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "BAD_JSON", detail: (e as Error).message },
      { status: 400 },
    );
  }

  const imageUrl = body.payload?.imageUrl;
  if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELD", message: "payload.imageUrl is required" },
      { status: 400 },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_URL" }, { status: 400 });
  }
  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return NextResponse.json(
      { ok: false, error: "BAD_URL", message: "Only http/https URLs are allowed" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SlipGate/1.0" },
    });
  } catch (e) {
    clearTimeout(timer);
    return NextResponse.json(
      { ok: false, error: "FETCH_FAILED", detail: (e as Error).message },
      { status: 502 },
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "FETCH_FAILED", message: `Upstream returned ${res.status}` },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "NOT_IMAGE", message: `content-type=${contentType || "unknown"}` },
      { status: 415 },
    );
  }

  // Stream-aware size guard: stop reading once we exceed MAX_BYTES.
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  return servePublicSlipVerify({
    auth,
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType.split(";")[0]?.trim() || "image/jpeg",
    conditions: body.payload?.checkCondition,
    fireWebhook: body.payload?.webhook === true,
    endpoint: "slip.url",
    start,
  });
}
