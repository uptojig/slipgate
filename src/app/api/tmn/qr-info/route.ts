import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { decodeTmnQr } from "@/lib/truemoney/qr-info";

export const runtime = "nodejs";

const Body = z.object({
  qr_value: z.string().min(20),
});

/**
 * POST /api/tmn/qr-info
 *
 * Wrapper around TrueMoney's `trans-qr-info` endpoint. Pass the raw QR
 * payload scanned off a TrueMoney slip and get back masked sender/
 * receiver + amount (satang) + datetime.
 *
 * Use the returned `receiver_last4` together with /api/slip/tmn-validate
 * for full verification when you know the transaction_id from elsewhere.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "BAD_INPUT", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await decodeTmnQr(parsed.data.qr_value);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    sender_mobile_masked: result.senderMobileMasked,
    receiver_mobile_masked: result.receiverMobileMasked,
    receiver_last4: result.receiverLast4,
    amount_satang: result.amountSatang,
    amount_baht: result.amountSatang / 100,
    message: result.message,
    transaction_date: result.transactionDate,
  });
}
