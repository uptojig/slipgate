import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { extractVoucherCode, redeemVoucher } from "@/lib/truemoney/voucher";
import { postLedger } from "@/lib/credit/ledger";
import { newId, sha256 } from "@/lib/utils";

export const runtime = "nodejs";

const Body = z.object({
  link: z.string().min(1),
  // Phone of the TrueWallet account that will receive the voucher (รับเข้า wallet ของผู้ใช้)
  receiverPhone: z.string().regex(/^0\d{9}$/, "เบอร์ 10 หลักขึ้นต้นด้วย 0"),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "BAD_INPUT", issues: parsed.error.issues }, { status: 400 });
  }

  const code = extractVoucherCode(parsed.data.link);
  if (!code) {
    return NextResponse.json({ ok: false, error: "BAD_VOUCHER", message: "ลิงก์ไม่ถูกต้อง" }, { status: 400 });
  }

  const voucherHash = sha256(code);

  // Idempotency: same voucher can only be redeemed once across all users in
  // this app. (TrueMoney also rejects on their side, but we want a clean error.)
  const existing = await db.query.vouchers.findFirst({
    where: eq(schema.vouchers.voucherHash, voucherHash),
  });
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "ALREADY_REDEEMED", message: "ซองนี้ถูกใช้ไปแล้ว" },
      { status: 409 },
    );
  }

  const result = await redeemVoucher({ code, mobileNumber: parsed.data.receiverPhone });

  const voucherId = newId("vch");

  if (!result.ok) {
    await db.insert(schema.vouchers).values({
      id: voucherId,
      userId: user.id,
      voucherHash,
      receiverPhone: parsed.data.receiverPhone,
      status: "failed",
      errorCode: result.code,
      errorMessage: result.message,
      raw: (result.raw ?? {}) as object,
    });
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: 400 },
    );
  }

  const credit = await postLedger({
    userId: user.id,
    kind: "tmn_voucher",
    amountSatang: result.amountSatang,
    externalRef: voucherHash,
    source: parsed.data.receiverPhone,
    note: "TrueMoney voucher",
    metadata: { voucherCode: code, rawAmount: result.rawAmount },
  });

  await db.insert(schema.vouchers).values({
    id: voucherId,
    userId: user.id,
    voucherHash,
    receiverPhone: parsed.data.receiverPhone,
    amountSatang: result.amountSatang,
    status: "redeemed",
    raw: (result.raw ?? {}) as object,
    creditedTxId: credit.txId || null,
  });

  return NextResponse.json({
    ok: true,
    amount_satang: result.amountSatang,
    amount_baht: result.rawAmount,
    balance_satang: credit.balance,
  });
}
