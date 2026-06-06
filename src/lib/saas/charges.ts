import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { postLedger, getBalance } from "@/lib/credit/ledger";

export const PRICE_PER_SLIP_SATANG = 20;
export const FREE_QUOTA_PER_MONTH = 100;

export function currentYearMonth(): string {
  const now = new Date();
  // Asia/Bangkok wall-clock month — billing cycle resets in user-local time.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = fmt.find((p) => p.type === "year")?.value ?? "0000";
  const m = fmt.find((p) => p.type === "month")?.value ?? "00";
  return `${y}-${m}`;
}

export type QuotaRow = {
  userId: string;
  freeRemaining: number;
  cycleKey: string;
  updatedAt: Date;
};

export async function getQuota(userId: string): Promise<QuotaRow> {
  const cycleKey = currentYearMonth();
  const existing = await db.query.userQuotas.findFirst({
    where: eq(schema.userQuotas.userId, userId),
  });

  if (!existing) {
    const row = {
      userId,
      freeRemaining: FREE_QUOTA_PER_MONTH,
      cycleKey,
      updatedAt: new Date(),
    };
    await db.insert(schema.userQuotas).values(row).onConflictDoNothing();
    return row;
  }

  if (existing.cycleKey !== cycleKey) {
    const updated = await db
      .update(schema.userQuotas)
      .set({
        freeRemaining: FREE_QUOTA_PER_MONTH,
        cycleKey,
        updatedAt: new Date(),
      })
      .where(eq(schema.userQuotas.userId, userId))
      .returning();
    return updated[0] ?? {
      userId,
      freeRemaining: FREE_QUOTA_PER_MONTH,
      cycleKey,
      updatedAt: new Date(),
    };
  }

  return existing;
}

export type ChargeResult =
  | { ok: true; usedFree: number; charged: number; balance: number; reason?: undefined }
  | { ok: false; usedFree: 0; charged: 0; balance: number; reason: "NO_CREDIT" };

/**
 * Atomically reserves billing for `units` slips:
 *   1. Consume monthly free quota first.
 *   2. For any remaining units, debit the wallet at PRICE_PER_SLIP_SATANG each.
 *
 * Sandbox keys short-circuit with a zero-cost success so customers can
 * exercise the API without burning credits or AI quota.
 */
export async function chargeForUsage(
  userId: string,
  units: number,
  isSandbox: boolean,
): Promise<ChargeResult> {
  if (units <= 0) {
    const bal = await getBalance(userId);
    return { ok: true, usedFree: 0, charged: 0, balance: bal };
  }

  if (isSandbox) {
    const bal = await getBalance(userId);
    return { ok: true, usedFree: 0, charged: 0, balance: bal };
  }

  await getQuota(userId);

  const cycleKey = currentYearMonth();

  // Reserve free quota in a single conditional update — only succeeds if the
  // row still belongs to this billing cycle and has the units available.
  const reserved = await db
    .update(schema.userQuotas)
    .set({
      freeRemaining: sql`${schema.userQuotas.freeRemaining} - ${units}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${schema.userQuotas.userId} = ${userId}
        AND ${schema.userQuotas.cycleKey} = ${cycleKey}
        AND ${schema.userQuotas.freeRemaining} >= ${units}`,
    )
    .returning({ freeRemaining: schema.userQuotas.freeRemaining });

  let usedFree = 0;
  let remainingUnits = units;
  if (reserved[0]) {
    usedFree = units;
    remainingUnits = 0;
  } else {
    const q = await getQuota(userId);
    if (q.freeRemaining > 0) {
      const take = Math.min(q.freeRemaining, units);
      const partial = await db
        .update(schema.userQuotas)
        .set({
          freeRemaining: sql`${schema.userQuotas.freeRemaining} - ${take}`,
          updatedAt: new Date(),
        })
        .where(
          sql`${schema.userQuotas.userId} = ${userId}
            AND ${schema.userQuotas.cycleKey} = ${cycleKey}
            AND ${schema.userQuotas.freeRemaining} >= ${take}`,
        )
        .returning({ freeRemaining: schema.userQuotas.freeRemaining });
      if (partial[0]) {
        usedFree = take;
        remainingUnits = units - take;
      }
    }
  }

  if (remainingUnits === 0) {
    const bal = await getBalance(userId);
    return { ok: true, usedFree, charged: 0, balance: bal };
  }

  const chargeSatang = remainingUnits * PRICE_PER_SLIP_SATANG;
  const currentBalance = await getBalance(userId);

  if (currentBalance < chargeSatang) {
    if (usedFree > 0) {
      // Refund the free units we reserved so the caller can retry after top-up.
      await db
        .update(schema.userQuotas)
        .set({
          freeRemaining: sql`${schema.userQuotas.freeRemaining} + ${usedFree}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.userQuotas.userId, userId));
    }
    return { ok: false, usedFree: 0, charged: 0, balance: currentBalance, reason: "NO_CREDIT" };
  }

  const debit = await postLedger({
    userId,
    kind: "adjust",
    amountSatang: -chargeSatang,
    note: "slip verify charge",
    metadata: { units: remainingUnits, pricePerSlipSatang: PRICE_PER_SLIP_SATANG },
  });

  return {
    ok: true,
    usedFree,
    charged: chargeSatang,
    balance: debit.balance,
  };
}
