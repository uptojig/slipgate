import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  verifyTmnRequest,
  tmnEventToLedgerKind,
  normaliseTmnPayload,
  type NormalisedTmnEvent,
} from "@/lib/truemoney/webhook";
import { postLedger } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhook/truemoney?u=<userId>
 *
 * Single endpoint that handles all 11 TrueMoney webhook event types
 * (4 inbound + 7 outbound) including auto-matching outbound bank
 * withdrawals against pending /api/withdraw requests.
 *
 * Setup in the TrueMoney app:
 *   ทรูมันนี่ → แจ้งรับเงิน/เติมเงิน OR แจ้งหักค่าธรรมเนียมและถอนเงิน
 *   → Endpoint URL = https://<your-domain>/api/webhook/truemoney?u=usr_XXXX
 */

// TMN's "ตั้งค่า API" validator pings the endpoint with GET/HEAD before
// accepting the URL. Return 200 so the URL passes validation; real events
// arrive via POST.
export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST with TMN JWT payload" });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  // TrueMoney's "ตั้งค่า API → ส่งข้อมูล" validator sends a test POST and
  // treats ANY non-2xx as "ติดต่อ server ปลายทางไม่ได้". So this handler
  // returns 200 for every well-formed request — including ones we choose to
  // ignore (bad signature, missing user, missing secret). Real DB/code
  // failures still throw → 500 (which TMN retries).
  try {
    const userIdToken = req.nextUrl.searchParams.get("u");
    if (!userIdToken) {
      return NextResponse.json({ ok: false, ignored: "missing_u" });
    }

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userIdToken),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, ignored: "user_not_found" });
    }

    const authKey = process.env.TMN_WEBHOOK_AUTH_KEY;
    const jwtSecret = process.env.TMN_WEBHOOK_JWT_SECRET;
    if (!authKey || !jwtSecret) {
      return NextResponse.json({ ok: false, ignored: "not_configured" });
    }

    const rawBody = await req.text();
    const result = verifyTmnRequest({
      authorizationHeader: req.headers.get("authorization"),
      rawBody,
      expectedAuthKey: authKey,
      jwtSecret,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, ignored: result.reason, detail: result.detail });
    }

    const payload = result.payload;
    const ev = normaliseTmnPayload(payload);

    // Idempotency check.
    const existingEvent = await db.query.tmnEvents.findFirst({
      where: (e, { eq }) => eq(e.transactionId, ev.externalRef),
    });
    if (existingEvent) {
      return NextResponse.json({ ok: true, duplicated: true });
    }

    const eventId = newId("tmev");
    await db.insert(schema.tmnEvents).values({
      id: eventId,
      transactionId: ev.externalRef,
      eventType: ev.eventType,
      rawPayload: payload as unknown as object,
      matchedUserId: user.id,
    });

    // ── INBOUND: credit the user wallet ──────────────────────────────
    if (ev.direction === "in") {
      const { kind } = tmnEventToLedgerKind(ev.eventType);
      if (!kind || kind === "withdraw" || kind === "adjust") {
        return NextResponse.json({ ok: true, logged: true, event_type: ev.eventType });
      }

      const credit = await postLedger({
        userId: user.id,
        kind,
        amountSatang: ev.amountSatang,
        externalRef: ev.externalRef,
        source: ev.counterpartyName ?? ev.counterpartyMobile ?? ev.channel,
        note: ev.note,
        metadata: payload as unknown as Record<string, unknown>,
      });

      if (credit.txId) {
        await db
          .update(schema.tmnEvents)
          .set({ matchedTransactionId: credit.txId })
          .where(eq(schema.tmnEvents.id, eventId));
      }

      return NextResponse.json({
        ok: true,
        direction: "in",
        credited: !credit.duplicated,
        event_type: ev.eventType,
        amount_satang: ev.amountSatang,
        balance_satang: credit.balance,
        transaction_id: ev.externalRef,
      });
    }

    // ── OUTBOUND: try to auto-match against pending withdrawal ───────
    // BANK_WITHDRAW carries destination account in `description`.
    // SEND_P2P carries destination phone in `merchant_name`.
    const matched = await tryMatchWithdrawal(user.id, ev, eventId);

    return NextResponse.json({
      ok: true,
      direction: "out",
      event_type: ev.eventType,
      amount_satang: Math.abs(ev.amountSatang),
      matched_withdrawal_id: matched?.id ?? null,
      transaction_id: ev.externalRef,
    });
  } catch (e) {
    // Real server faults bubble up as 500 (TMN will retry).
    console.error("[truemoney webhook] fatal:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

/**
 * If the outbound event matches a still-open withdrawal request
 * (same user, same amount, same destination account, status='approved'
 * or 'requested', within last 24h), mark it as 'paid' and write a
 * negative ledger entry for the actual movement.
 */
async function tryMatchWithdrawal(
  userId: string,
  ev: NormalisedTmnEvent,
  eventId: string,
) {
  const amountSatang = Math.abs(ev.amountSatang);
  const destCandidate =
    ev.eventType === "SEND_P2P"
      ? ev.counterpartyMobile
      : ev.eventType === "BANK_WITHDRAW"
        ? ev.note // description = bank account number
        : null;

  if (!destCandidate) return null;

  // Find an open withdrawal request matching this destination + amount.
  const since = new Date(Date.now() - 7 * 24 * 3600_000); // 7-day window
  const candidates = await db
    .select()
    .from(schema.withdrawals)
    .where(
      and(
        eq(schema.withdrawals.userId, userId),
        eq(schema.withdrawals.amountSatang, amountSatang),
        eq(schema.withdrawals.destAccount, destCandidate),
        isNull(schema.withdrawals.processedAt),
        gte(schema.withdrawals.createdAt, since),
      ),
    )
    .limit(1);

  const wd = candidates[0];
  if (!wd) return null;

  // Record the actual debit + mark withdrawal paid.
  const credit = await postLedger({
    userId,
    kind: "withdraw",
    amountSatang: -amountSatang, // signed: outflow
    externalRef: ev.externalRef,
    source: ev.counterpartyName ?? destCandidate,
    note: `auto-matched withdrawal ${wd.id}`,
    metadata: { event: ev.eventType, withdrawal_id: wd.id },
  });

  await db
    .update(schema.withdrawals)
    .set({ status: "paid", processedAt: new Date(), txId: credit.txId || null })
    .where(eq(schema.withdrawals.id, wd.id));

  if (credit.txId) {
    await db
      .update(schema.tmnEvents)
      .set({ matchedTransactionId: credit.txId })
      .where(eq(schema.tmnEvents.id, eventId));
  }

  return wd;
}
