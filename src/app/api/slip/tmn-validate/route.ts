import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { validateTmnP2P } from "@/lib/truemoney/p2p-validate";
import { postLedger } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const Body = z.object({
  /** sender phone — 10 digits, or "" / omit if unknown */
  sender_mobile: z.string().regex(/^(\d{10})?$/).optional(),
  /** receiver phone — 10 digits; matched on last 4 digits */
  receiver_mobile: z.string().regex(/^\d{10}$/, "must be 10 digits"),
  /** TrueMoney transaction id from the slip */
  transaction_id: z.string().min(6),
  /** amount in satang (integer) */
  amount_satang: z.number().int().positive(),
  /** "yyyy-mm-dd HH:mm" or "yyyy-mm-dd HH" */
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}(:\d{2})?$/),
  /** if true and match_type=confirmed, credit caller's wallet */
  credit: z.boolean().default(false),
});

/**
 * POST /api/slip/tmn-validate
 *   Authorization: Bearer sk_xxx
 *
 * Verifies a TrueMoney P2P transfer against the official validation
 * endpoint (apis.truemoneyservices.com/validate/v1/p2p). The caller
 * supplies the 5 slip fields; the API confirms whether the transfer
 * actually occurred.
 *
 * If credit=true and match_type=confirmed, we add the amount to the
 * caller's wallet (idempotent on transaction_id).
 */
export async function POST(req: NextRequest) {
  // Accept either a dashboard session cookie or a Bearer API key. The
  // dashboard tool at /dashboard/tmn-tools calls this endpoint directly
  // from the browser without an API key — falling back to the session
  // keeps that flow working while still allowing programmatic access.
  let userId: string | null = null;
  let apiKeyId: string | null = null;
  const sessionUser = await getCurrentUser();
  if (sessionUser) {
    userId = sessionUser.id;
  } else {
    const auth = await authenticateApiRequest(req.headers.get("authorization"));
    if (auth) {
      userId = auth.userId;
      apiKeyId = auth.apiKeyId;
    }
  }
  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  void apiKeyId; // reserved for future per-key usage logging

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "BAD_INPUT", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await validateTmnP2P({
    sender_mobile: parsed.data.sender_mobile,
    receiver_mobile: parsed.data.receiver_mobile,
    transaction_id: parsed.data.transaction_id,
    amount_satang: parsed.data.amount_satang,
    transaction_date: parsed.data.transaction_date,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status ?? 400 },
    );
  }

  // The validate API confirms the transfer occurred, but does NOT return
  // the canonical amount/sender — it only echoes "yes that matches".
  // We trust the caller's submitted fields when crediting.
  let credited = false;
  let balance: number | null = null;

  if (parsed.data.credit && result.matchType === "confirmed") {
    const dup = await db.query.slips.findFirst({
      where: eq(schema.slips.transRef, parsed.data.transaction_id),
    });
    if (!dup) {
      const credit = await postLedger({
        userId,
        kind: "tmn_incoming",
        amountSatang: parsed.data.amount_satang,
        externalRef: parsed.data.transaction_id,
        source: parsed.data.sender_mobile || null,
        note: "TMN slip verified via validate/v1/p2p",
        metadata: { match_type: result.matchType, message: result.message },
      });
      credited = !credit.duplicated;
      balance = credit.balance;

      await db.insert(schema.slips).values({
        id: newId("slp"),
        userId,
        method: "easyslip",
        sourceName: parsed.data.sender_mobile || null,
        targetName: parsed.data.receiver_mobile,
        amountSatang: parsed.data.amount_satang,
        slipDatetime: new Date(parsed.data.transaction_date.replace(" ", "T") + ":00+07:00"),
        transRef: parsed.data.transaction_id,
        raw: { match_type: result.matchType, message: result.message } as object,
        verified: true,
        creditedTxId: credit.txId || null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    match_type: result.matchType,
    message: result.message,
    confirmed: result.matchType === "confirmed",
    credited,
    balance_satang: balance,
  });
}
