import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { getMyLastReceive, normaliseReceive } from "@/lib/truemoney/account";
import { postLedger } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tmn/sync
 *
 * Manually pulls the latest received transaction from the official
 * TrueMoney `my-last-receive` endpoint and credits it to the caller's
 * wallet if it is new (idempotent on `transaction_id`).
 *
 * This is a BACKUP path. The webhook (`/api/webhook/truemoney`) is the
 * primary mechanism — sync is for cases where:
 *   • the webhook URL is misconfigured
 *   • a delivery was dropped
 *   • the user wants an immediate "refresh now" button in the dashboard
 *
 * Authentication: session cookie OR Bearer API key.
 *
 * Rate limit consideration: TrueMoney allows 30 req / 30 sec. Don't
 * call this faster than once per second across all your users.
 */
export async function POST(req: NextRequest) {
  // Accept either the dashboard session or an API key.
  let userId: string | null = null;
  const sessionUser = await getCurrentUser();
  if (sessionUser) {
    userId = sessionUser.id;
  } else {
    const auth = await authenticateApiRequest(req.headers.get("authorization"));
    if (auth) userId = auth.userId;
  }
  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await getMyLastReceive();
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.code,
        message: result.message,
        rate_limited: result.code === "RATE_LIMITED",
      },
      { status: result.code === "RATE_LIMITED" ? 429 : 400 },
    );
  }

  const tx = normaliseReceive(result.data);

  // Idempotency on the canonical transaction_id.
  const existing = await db.query.tmnEvents.findFirst({
    where: eq(schema.tmnEvents.transactionId, tx.transactionId),
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      new: false,
      transaction_id: tx.transactionId,
      amount_satang: tx.amountSatang,
      received_time: tx.receivedTime,
    });
  }

  // Persist event log + credit ledger atomically.
  await db.insert(schema.tmnEvents).values({
    id: newId("tmev"),
    transactionId: tx.transactionId,
    eventType: tx.eventType,
    rawPayload: result.data as unknown as object,
    matchedUserId: userId,
  });

  const credit = await postLedger({
    userId,
    kind: tx.eventType === "P2P" ? "tmn_incoming" : "tmn_topup",
    amountSatang: tx.amountSatang,
    externalRef: tx.transactionId,
    source: tx.senderMobile,
    note: tx.message,
    metadata: result.data as unknown as Record<string, unknown>,
  });

  return NextResponse.json({
    ok: true,
    new: !credit.duplicated,
    transaction_id: tx.transactionId,
    amount_satang: tx.amountSatang,
    amount_baht: tx.amountSatang / 100,
    sender_mobile: tx.senderMobile,
    receiver_mobile: tx.receiverMobile,
    received_time: tx.receivedTime,
    balance_satang: credit.balance,
  });
}
