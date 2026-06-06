import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { decodeSlipQr } from "@/lib/slip/qr";
import { parseSlipQr, bankNameFromCode } from "@/lib/slip/parser";
import { ocrSlipImage } from "@/lib/slip/ocr";
import { chargeForUsage } from "@/lib/saas/charges";
import { recordUsage } from "@/lib/saas/usage";
import { sandboxSlipResult } from "@/lib/saas/sandbox";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 50;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

type SlipOutput = {
  index: number;
  ok: boolean;
  method?: "qr" | "ocr" | "sandbox";
  verified?: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
};

async function processOne(buffer: Buffer, mime: string): Promise<Omit<SlipOutput, "index">> {
  const qrPayload = await decodeSlipQr(buffer).catch(() => null);
  let parsedQr: ReturnType<typeof parseSlipQr> | null = null;
  let method: "qr" | "ocr" = "ocr";
  if (qrPayload) {
    parsedQr = parseSlipQr(qrPayload);
    method = "qr";
  }

  let ocr: Awaited<ReturnType<typeof ocrSlipImage>> = null;
  try {
    ocr = await ocrSlipImage(buffer, mime || "image/jpeg");
  } catch {
    // Tolerate per-slip OCR failures — QR may still be enough.
  }

  let amountSatang: number | null = null;
  if (typeof ocr?.amount === "number") amountSatang = Math.round(ocr.amount * 100);
  else if (typeof parsedQr?.amount === "number") amountSatang = Math.round(parsedQr.amount * 100);

  const transRef = ocr?.transRef ?? parsedQr?.transRef ?? null;
  const sourceBank = ocr?.sourceBank ?? bankNameFromCode(parsedQr?.bankCode) ?? null;
  const verified = Boolean(transRef && amountSatang);

  return {
    ok: true,
    method,
    verified,
    data: {
      amount_satang: amountSatang,
      trans_ref: transRef,
      source_bank: sourceBank,
      target_bank: ocr?.targetBank ?? null,
      source_name: ocr?.sourceName ?? null,
      target_name: ocr?.targetName ?? null,
      datetime: ocr?.datetime ?? null,
      verified,
      method,
    },
  };
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "BAD_FORM" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_FILES", message: `Max ${MAX_FILES} files per request` },
      { status: 413 },
    );
  }
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
    }
  }

  const count = files.length;

  if (auth.isSandbox) {
    const results: SlipOutput[] = files.map((_, i) => ({
      index: i,
      ok: true,
      method: "sandbox",
      verified: true,
      data: sandboxSlipResult(crypto.randomUUID()),
    }));
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint: "slip.bulk",
      units: count,
      chargedSatang: 0,
      sandbox: true,
      success: true,
      durationMs: Date.now() - start,
    });
    return NextResponse.json({
      ok: true,
      count,
      results,
      billing: { charged_satang: 0, used_free: 0, balance_satang: null, sandbox: true },
    });
  }

  const charge = await chargeForUsage(auth.userId, count, false);
  if (!charge.ok) {
    await recordUsage({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      endpoint: "slip.bulk",
      units: count,
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

  const results: SlipOutput[] = [];
  let successCount = 0;
  // Serial processing: sharp+jsQR aren't safe to run concurrently in one process.
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const buf = Buffer.from(await f.arrayBuffer());
      const r = await processOne(buf, f.type);
      results.push({ index: i, ...r });
      if (r.verified) successCount++;

      const transRef = (r.data?.trans_ref ?? null) as string | null;
      const amountSatang = (r.data?.amount_satang ?? null) as number | null;
      await db
        .insert(schema.slips)
        .values({
          id: newId("slp"),
          userId: auth.userId,
          method: r.method ?? "ocr",
          sourceBank: (r.data?.source_bank ?? null) as string | null,
          targetBank: (r.data?.target_bank ?? null) as string | null,
          sourceName: (r.data?.source_name ?? null) as string | null,
          targetName: (r.data?.target_name ?? null) as string | null,
          amountSatang,
          slipDatetime: r.data?.datetime ? new Date(r.data.datetime as string) : null,
          transRef,
          verified: Boolean(r.verified),
          raw: r.data as object,
        })
        .catch(() => {});
    } catch (e) {
      results.push({ index: i, ok: false, error: (e as Error).message });
    }
  }

  await recordUsage({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    endpoint: "slip.bulk",
    units: count,
    chargedSatang: charge.charged,
    sandbox: false,
    success: successCount > 0,
    durationMs: Date.now() - start,
    metadata: { count, successCount },
  });

  return NextResponse.json({
    ok: true,
    count,
    results,
    billing: {
      charged_satang: charge.charged,
      used_free: charge.usedFree,
      balance_satang: charge.balance,
    },
  });
}
