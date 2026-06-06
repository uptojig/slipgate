import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { decodeSlipQr } from "@/lib/slip/qr";
import { parseSlipQr, bankNameFromCode } from "@/lib/slip/parser";
import { ocrSlipImage } from "@/lib/slip/ocr";
import { chargeForUsage } from "@/lib/saas/charges";
import { recordUsage } from "@/lib/saas/usage";
import { sandboxSlipResult } from "@/lib/saas/sandbox";
import { deliverCustomerWebhook } from "@/lib/saas/customer-webhook";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "BAD_FORM" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
  }
  const fireWebhook = form.get("webhook") === "1" || form.get("webhook") === "true";

  if (auth.isSandbox) {
    const sandbox = sandboxSlipResult(crypto.randomUUID());
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint: "slip.verify",
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
      data: sandbox,
      billing: { charged_satang: 0, used_free: 0, balance_satang: null, sandbox: true },
    });
  }

  const charge = await chargeForUsage(auth.userId, 1, false);
  if (!charge.ok) {
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint: "slip.verify",
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

  const buffer = Buffer.from(await file.arrayBuffer());

  const qrPayload = await decodeSlipQr(buffer).catch(() => null);
  let parsedQr: ReturnType<typeof parseSlipQr> | null = null;
  let method: "qr" | "ocr" = "ocr";
  if (qrPayload) {
    parsedQr = parseSlipQr(qrPayload);
    method = "qr";
  }

  let ocr: Awaited<ReturnType<typeof ocrSlipImage>> = null;
  let ocrError: string | null = null;
  try {
    ocr = await ocrSlipImage(buffer, file.type || "image/jpeg");
  } catch (e) {
    ocrError = (e as Error).message;
  }

  let amountSatang: number | null = null;
  if (typeof ocr?.amount === "number") amountSatang = Math.round(ocr.amount * 100);
  else if (typeof parsedQr?.amount === "number") amountSatang = Math.round(parsedQr.amount * 100);

  const transRef = ocr?.transRef ?? parsedQr?.transRef ?? null;
  const sourceBank = ocr?.sourceBank ?? bankNameFromCode(parsedQr?.bankCode) ?? null;
  const targetBank = ocr?.targetBank ?? null;
  const sourceName = ocr?.sourceName ?? null;
  const targetName = ocr?.targetName ?? null;
  const datetime = ocr?.datetime ?? null;

  const verified = Boolean(transRef && amountSatang);

  const slipId = newId("slp");
  await db
    .insert(schema.slips)
    .values({
      id: slipId,
      userId: auth.userId,
      method,
      sourceBank,
      targetBank,
      sourceAccount: ocr?.sourceAccount ?? null,
      targetAccount: ocr?.targetAccount ?? null,
      sourceName,
      targetName,
      amountSatang,
      slipDatetime: datetime ? new Date(datetime) : null,
      transRef: transRef ?? null,
      qrPayload: qrPayload ?? null,
      raw: { qr: parsedQr, ocr, ocrError } as object,
      verified,
      creditedTxId: null,
    })
    .catch(() => {});

  const data = {
    amount_satang: amountSatang,
    trans_ref: transRef,
    source_bank: sourceBank,
    target_bank: targetBank,
    source_name: sourceName,
    target_name: targetName,
    datetime,
    verified,
    method,
  };

  await recordUsage({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    endpoint: "slip.verify",
    units: 1,
    chargedSatang: charge.charged,
    sandbox: false,
    success: verified,
    errorCode: verified ? null : "UNVERIFIED",
    durationMs: Date.now() - start,
    metadata: { transRef, method },
  });

  if (fireWebhook && verified) {
    deliverCustomerWebhook(auth.userId, "slip.verified", data);
  }

  return NextResponse.json({
    ok: true,
    method,
    verified,
    data,
    billing: {
      charged_satang: charge.charged,
      used_free: charge.usedFree,
      balance_satang: charge.balance,
    },
  });
}
