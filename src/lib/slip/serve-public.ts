/**
 * Public SaaS slip-verify pipeline shared by every /api/v1/slip/* endpoint.
 *
 * Each endpoint is responsible only for extracting the raw image buffer
 * (from multipart, base64, or a remote URL) and the optional CheckCondition.
 * This module handles everything else: sandbox short-circuit, credit charge,
 * QR+OCR parse, condition evaluation, slip persistence, usage logging, and
 * the customer webhook fan-out.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { parseSlipBuffer } from "@/lib/slip/core";
import { evaluateConditions, type CheckCondition } from "@/lib/slip/conditions";
import { chargeForUsage } from "@/lib/saas/charges";
import { recordUsage } from "@/lib/saas/usage";
import { sandboxSlipResult } from "@/lib/saas/sandbox";
import { deliverCustomerWebhook } from "@/lib/saas/customer-webhook";
import { newId } from "@/lib/utils";

export type PublicSlipAuth = {
  userId: string;
  apiKeyId: string;
  isSandbox: boolean;
};

export type ServePublicOpts = {
  auth: PublicSlipAuth;
  buffer: Buffer;
  mimeType: string;
  conditions?: CheckCondition;
  fireWebhook?: boolean;
  endpoint: string; // e.g. "slip.verify", "slip.base64", "slip.url"
  start: number;    // Date.now() at the moment the request was received
};

export async function servePublicSlipVerify(opts: ServePublicOpts): Promise<NextResponse> {
  const { auth, buffer, mimeType, conditions, fireWebhook, endpoint, start } = opts;

  // 1. Sandbox short-circuit — no billing, deterministic fixture.
  if (auth.isSandbox) {
    const sandbox = sandboxSlipResult(crypto.randomUUID());
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint,
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

  // 2. Charge — fail fast on insufficient credit.
  const charge = await chargeForUsage(auth.userId, 1, false);
  if (!charge.ok) {
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint,
      units: 1,
      chargedSatang: 0,
      sandbox: false,
      success: false,
      errorCode: "NO_CREDIT",
      durationMs: Date.now() - start,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "NO_CREDIT",
        message: "Insufficient credit. Top up at /dashboard/topup",
        balance_satang: charge.balance,
      },
      { status: 402 },
    );
  }

  // 3. Parse + evaluate conditions.
  const parsed = await parseSlipBuffer(buffer, mimeType);
  const validation = await evaluateConditions(parsed, conditions, { userId: auth.userId });
  const verified = Boolean(parsed.transRef && parsed.amountSatang) && validation.passed;

  // 4. Persist slip row (best-effort — never block the response on DB).
  await db
    .insert(schema.slips)
    .values({
      id: newId("slp"),
      userId: auth.userId,
      method: parsed.method,
      sourceBank: parsed.sourceBank,
      targetBank: parsed.targetBank,
      sourceAccount: parsed.sourceAccount,
      targetAccount: parsed.targetAccount,
      sourceName: parsed.sourceName,
      targetName: parsed.targetName,
      amountSatang: parsed.amountSatang,
      slipDatetime: parsed.datetime ? new Date(parsed.datetime) : null,
      transRef: parsed.transRef,
      qrPayload: parsed.qrPayload,
      raw: { qr: parsed.parsedQr, ocr: parsed.ocr, ocrError: parsed.ocrError } as object,
      verified,
      creditedTxId: null,
    })
    .catch(() => {});

  const data = {
    amount_satang: parsed.amountSatang,
    trans_ref: parsed.transRef,
    source_bank: parsed.sourceBank,
    target_bank: parsed.targetBank,
    source_name: parsed.sourceName,
    target_name: parsed.targetName,
    source_account: parsed.sourceAccount,
    target_account: parsed.targetAccount,
    datetime: parsed.datetime,
    verified,
    method: parsed.method,
  };

  await recordUsage({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    endpoint,
    units: 1,
    chargedSatang: charge.charged,
    sandbox: false,
    success: verified,
    errorCode: verified ? null : "UNVERIFIED",
    durationMs: Date.now() - start,
    metadata: { transRef: parsed.transRef, method: parsed.method, validation },
  });

  if (fireWebhook && verified) {
    deliverCustomerWebhook(auth.userId, "slip.verified", data);
  }

  return NextResponse.json({
    ok: true,
    method: parsed.method,
    verified,
    validation,
    data,
    billing: {
      charged_satang: charge.charged,
      used_free: charge.usedFree,
      balance_satang: charge.balance,
    },
  });
}
