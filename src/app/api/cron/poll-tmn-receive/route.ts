import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMyLastReceive, normaliseReceive } from "@/lib/truemoney/account";
import { tmnEventToLedgerKind } from "@/lib/truemoney/webhook";
import { postLedger } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polling fallback for TrueMoney inbound events.
 *
 * Why: the TMN app's "แจ้งรับเงิน/เติมเงิน" webhook setup page is broken
 * for some accounts (renders blank, can't reveal the auth key), so we
 * can't register an inbound webhook. We fall back to polling the
 * `my-last-receive` API every ~30s — within the 30 req/30 sec rate limit.
 *
 * Trigger via systemd timer, curl loop, or external cron:
 *   curl -fsS "https://remoobbg.com/api/cron/poll-tmn-receive" \
 *     -H "Authorization: Bearer $POLL_CRON_SECRET"
 *
 * Config:
 *   POLL_CRON_SECRET     — shared secret for cron auth
 *   TMN_INBOUND_USER_ID  — user_id to credit (single-tenant TMN account)
 *   TMN_LAST_RECEIVE_TOKEN — bearer token for the my-last-receive API
 *
 * Caveat: `my-last-receive` returns only the LATEST received transaction.
 * Polling cadence must beat the highest expected event rate, or earlier
 * events will be lost. For a more-than-one-per-30s rate, switch to a
 * paginated history endpoint (TMN_RECEIVED_TRANSFER_TOKEN, future).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.POLL_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "POLL_CRON_SECRET not set" }, { status: 503 });
  }

  const provided = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const queryToken = req.nextUrl.searchParams.get("s")?.trim() ?? "";
  if (provided !== secret && queryToken !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = process.env.TMN_INBOUND_USER_ID;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "TMN_INBOUND_USER_ID not set" }, { status: 503 });
  }

  const res = await getMyLastReceive();
  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      error: "tmn_api_failed",
      code: res.code,
      detail: res.message,
    });
  }

  const ev = normaliseReceive(res.data);
  if (!ev.transactionId) {
    return NextResponse.json({ ok: true, skipped: "no_transaction" });
  }

  const existing = await db.query.tmnEvents.findFirst({
    where: eq(schema.tmnEvents.transactionId, ev.transactionId),
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicated: true,
      transaction_id: ev.transactionId,
    });
  }

  const { kind } = tmnEventToLedgerKind(ev.eventType);
  if (!kind || kind === "withdraw" || kind === "adjust") {
    return NextResponse.json({
      ok: true,
      logged: false,
      reason: "non_inbound_event_type",
      event_type: ev.eventType,
    });
  }

  const eventId = newId("tmev");
  await db.insert(schema.tmnEvents).values({
    id: eventId,
    transactionId: ev.transactionId,
    eventType: ev.eventType,
    rawPayload: res.data as unknown as object,
    matchedUserId: userId,
  });

  const credit = await postLedger({
    userId,
    kind,
    amountSatang: ev.amountSatang,
    externalRef: ev.transactionId,
    source: ev.senderMobile ?? null,
    note: ev.message,
    metadata: res.data as unknown as Record<string, unknown>,
  });

  if (credit.txId) {
    await db
      .update(schema.tmnEvents)
      .set({ matchedTransactionId: credit.txId })
      .where(eq(schema.tmnEvents.id, eventId));
  }

  return NextResponse.json({
    ok: true,
    credited: !credit.duplicated,
    event_type: ev.eventType,
    transaction_id: ev.transactionId,
    amount_satang: ev.amountSatang,
    sender_mobile: ev.senderMobile,
    balance_satang: credit.balance,
  });
}
