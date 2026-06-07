import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { parseSlipBuffer } from "@/lib/slip/core";
import { evaluateConditions, type CheckCondition } from "@/lib/slip/conditions";
import { postLedger } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/slip/verify
 *   multipart/form-data:
 *     file:         image of the slip (required)
 *     credit:       "1" to auto-credit user wallet on success (requires login)
 *     conditions:   optional JSON string — CheckCondition shape
 *                   (checkDuplicate, checkReceiver[], checkAmount, checkDate)
 *
 * Internal dashboard endpoint — no API-key auth, charged against the session
 * user when credit=1. For the public SaaS surface see /api/v1/slip/*.
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

  let conditions: CheckCondition | undefined;
  const rawConditions = form.get("conditions");
  if (typeof rawConditions === "string" && rawConditions.trim()) {
    try {
      conditions = JSON.parse(rawConditions) as CheckCondition;
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "BAD_CONDITIONS", detail: (e as Error).message },
        { status: 400 },
      );
    }
  }

  const parsed = await parseSlipBuffer(buffer, file.type || "image/jpeg");
  const user = await getCurrentUser();

  // Built-in dedup (independent of caller-supplied checkDuplicate) so we
  // never double-credit on the same transRef.
  if (parsed.transRef) {
    const dup = await db.query.slips.findFirst({
      where: eq(schema.slips.transRef, parsed.transRef),
    });
    if (dup) {
      const validation = await evaluateConditions(parsed, conditions, { userId: user?.id ?? null });
      return NextResponse.json({
        ok: true,
        duplicated: true,
        validation,
        data: shapeData(parsed),
      });
    }
  }

  const validation = await evaluateConditions(parsed, conditions, { userId: user?.id ?? null });
  let creditedTxId: string | null = null;
  let balance: number | null = null;

  // Only credit when there are no conditions (caller didn't ask for
  // validation) OR when every supplied condition passed. This keeps the old
  // behaviour while honouring new caller intent.
  const conditionsOk = validation.passed;

  if (shouldCredit && user && parsed.amountSatang && parsed.transRef && conditionsOk) {
    const credit = await postLedger({
      userId: user.id,
      kind: "bank_slip",
      amountSatang: parsed.amountSatang,
      externalRef: parsed.transRef,
      source: parsed.sourceName ?? parsed.sourceBank ?? null,
      note: "Slip-verified credit",
      metadata: { ocr: parsed.ocr, qr: parsed.parsedQr },
    });
    creditedTxId = credit.txId || null;
    balance = credit.balance;
  }

  const slipId = newId("slp");
  await db.insert(schema.slips).values({
    id: slipId,
    userId: user?.id ?? null,
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
    verified: Boolean(parsed.transRef && parsed.amountSatang && parsed.parsedQr),
    creditedTxId,
  });

  return NextResponse.json({
    ok: true,
    method: parsed.method,
    credited: Boolean(creditedTxId),
    balance_satang: balance,
    validation,
    data: shapeData(parsed),
  });
}

function shapeData(parsed: Awaited<ReturnType<typeof parseSlipBuffer>>) {
  return {
    amountSatang: parsed.amountSatang,
    transRef: parsed.transRef,
    sourceBank: parsed.sourceBank,
    targetBank: parsed.targetBank,
    sourceName: parsed.sourceName,
    targetName: parsed.targetName,
    sourceAccount: parsed.sourceAccount,
    targetAccount: parsed.targetAccount,
    datetime: parsed.datetime,
    qr: parsed.parsedQr,
  };
}
