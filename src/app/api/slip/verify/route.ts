import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { decodeSlipQr } from "@/lib/slip/qr";
import { parseSlipQr, bankNameFromCode } from "@/lib/slip/parser";
import { ocrSlipImage } from "@/lib/slip/ocr";
import { postLedger } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/slip/verify
 *   multipart/form-data:
 *     file:    image of the slip
 *     credit:  "1" to auto-credit user wallet on success (requires login)
 */
export async function POST(req: NextRequest) {
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

  const shouldCredit = form.get("credit") === "1";
  const buffer = Buffer.from(await file.arrayBuffer());

  // 1. Try QR decode first (cheap + deterministic for native Thai bank slips).
  const qrPayload = await decodeSlipQr(buffer).catch(() => null);

  let parsedQr: ReturnType<typeof parseSlipQr> | null = null;
  let method: "qr" | "ocr" = "ocr";

  if (qrPayload) {
    parsedQr = parseSlipQr(qrPayload);
    method = "qr";
  }

  // 2. Always run OCR for visual fields (amount, names, datetime). The QR
  //    payload alone is enough to identify uniqueness, but the OCR fills in
  //    human-readable details. If no AI gateway is configured, we still
  //    return the QR-derived data.
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
  const sourceBank = ocr?.sourceBank ?? bankNameFromCode(parsedQr?.bankCode);
  const sourceName = ocr?.sourceName ?? null;
  const targetName = ocr?.targetName ?? null;
  const datetime = ocr?.datetime ?? null;

  // Persist slip record.
  const slipId = newId("slp");
  const user = await getCurrentUser();

  // Reject duplicate transRef (replay protection).
  if (transRef) {
    const dup = await db.query.slips.findFirst({
      where: eq(schema.slips.transRef, transRef),
    });
    if (dup) {
      return NextResponse.json({
        ok: true,
        duplicated: true,
        data: { transRef, amountSatang, sourceBank, qr: parsedQr, ocr },
      });
    }
  }

  let creditedTxId: string | null = null;
  let balance: number | null = null;

  if (shouldCredit && user && amountSatang && transRef) {
    const credit = await postLedger({
      userId: user.id,
      kind: "bank_slip",
      amountSatang,
      externalRef: transRef,
      source: ocr?.sourceName ?? sourceBank ?? null,
      note: "Slip-verified credit",
      metadata: { ocr, qr: parsedQr },
    });
    creditedTxId = credit.txId || null;
    balance = credit.balance;
  }

  await db.insert(schema.slips).values({
    id: slipId,
    userId: user?.id ?? null,
    method,
    sourceBank: sourceBank ?? null,
    targetBank: ocr?.targetBank ?? null,
    sourceAccount: ocr?.sourceAccount ?? null,
    targetAccount: ocr?.targetAccount ?? null,
    sourceName,
    targetName,
    amountSatang,
    slipDatetime: datetime ? new Date(datetime) : null,
    transRef: transRef ?? null,
    qrPayload: qrPayload ?? null,
    raw: { qr: parsedQr, ocr, ocrError } as object,
    verified: Boolean(transRef && amountSatang && parsedQr),
    creditedTxId,
  });

  return NextResponse.json({
    ok: true,
    method,
    credited: Boolean(creditedTxId),
    balance_satang: balance,
    data: {
      amountSatang,
      transRef,
      sourceBank,
      targetBank: ocr?.targetBank,
      sourceName,
      targetName,
      sourceAccount: ocr?.sourceAccount ?? null,
      targetAccount: ocr?.targetAccount ?? null,
      datetime,
      qr: parsedQr,
    },
  });
}
