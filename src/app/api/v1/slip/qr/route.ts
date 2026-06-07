import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { parseSlipFromQrText } from "@/lib/slip/core";
import { servePublicSlipParsed } from "@/lib/slip/serve-public";
import { sandboxSlipResult } from "@/lib/saas/sandbox";
import { recordUsage } from "@/lib/saas/usage";
import type { CheckCondition } from "@/lib/slip/conditions";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

/**
 * POST /api/v1/slip/qr
 *
 * For callers that already have the raw EMVCo TLV string (e.g. read directly
 * from a scanner or copied from another system) — skips the image OCR step
 * entirely and just parses the payload.
 *
 *   { "payload": { "qrText": "00020101...6304XXXX", "checkCondition": {...} } }
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  let body: { payload?: { qrText?: string; checkCondition?: CheckCondition; webhook?: boolean } };
  try {
    body = (await req.json()) as typeof body;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "BAD_JSON", detail: (e as Error).message },
      { status: 400 },
    );
  }

  const qrText = body.payload?.qrText?.trim();
  if (!qrText) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELD", message: "payload.qrText is required" },
      { status: 400 },
    );
  }

  // Sandbox keys never call the parser — return the fixture directly so the
  // caller can wire up integration tests without a real EMVCo string.
  if (auth.isSandbox) {
    const sandbox = sandboxSlipResult(crypto.randomUUID());
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint: "slip.qr",
      units: 1,
      chargedSatang: 0,
      sandbox: true,
      success: true,
      durationMs: Date.now() - start,
    });
    return NextResponse.json({
      ok: true,
      method: "sandbox",
      verified: true,
      validation: { passed: true, checks: [] },
      data: sandbox,
      billing: { charged_satang: 0, used_free: 0, balance_satang: null, sandbox: true },
    });
  }

  const parsed = parseSlipFromQrText(qrText);
  // Minimal sanity check — a valid Thai slip-verify QR always has a bank
  // code and either a transRef or amount.
  if (!parsed.parsedQr || (!parsed.transRef && !parsed.parsedQr.bankCode)) {
    return NextResponse.json(
      { ok: false, error: "BAD_QR", message: "QR text could not be parsed as a slip-verify payload" },
      { status: 422 },
    );
  }

  return servePublicSlipParsed({
    auth,
    parsed,
    conditions: body.payload?.checkCondition,
    fireWebhook: body.payload?.webhook === true,
    endpoint: "slip.qr",
    start,
  });
}
