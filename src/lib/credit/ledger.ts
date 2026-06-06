import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "@/lib/utils";

export type CreditInput = {
  userId: string;
  kind: typeof schema.txKindEnum.enumValues[number];
  amountSatang: number;          // positive for credit, negative for debit
  externalRef?: string | null;
  source?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: typeof schema.txStatusEnum.enumValues[number];
};

/**
 * Atomically writes a transaction row and updates the wallet balance.
 * Uses ON CONFLICT to make webhook delivery idempotent on (kind, externalRef).
 */
export async function postLedger(input: CreditInput): Promise<{ txId: string; balance: number; duplicated: boolean }> {
  const txId = newId("tx");
  const status = input.status ?? "success";

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.transactions)
      .values({
        id: txId,
        userId: input.userId,
        kind: input.kind,
        status,
        amountSatang: input.amountSatang,
        externalRef: input.externalRef ?? null,
        source: input.source ?? null,
        note: input.note ?? null,
        metadata: input.metadata ?? null,
      })
      .onConflictDoNothing({
        target: [schema.transactions.kind, schema.transactions.externalRef],
      })
      .returning({ id: schema.transactions.id });

    const inserted0 = inserted[0];
    if (!inserted0) {
      // already credited — fetch existing balance and return duplicated=true
      const wal = await tx.query.wallets.findFirst({ where: eq(schema.wallets.userId, input.userId) });
      return { txId: "", balance: wal?.balanceSatang ?? 0, duplicated: true };
    }

    // only success-state transactions move the balance
    if (status === "success") {
      const result = await tx
        .update(schema.wallets)
        .set({
          balanceSatang: sql`${schema.wallets.balanceSatang} + ${input.amountSatang}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.wallets.userId, input.userId))
        .returning({ balance: schema.wallets.balanceSatang });
      return { txId: inserted0.id, balance: result[0]?.balance ?? 0, duplicated: false };
    }

    const wal = await tx.query.wallets.findFirst({ where: eq(schema.wallets.userId, input.userId) });
    return { txId: inserted0.id, balance: wal?.balanceSatang ?? 0, duplicated: false };
  });
}

export async function getBalance(userId: string): Promise<number> {
  const w = await db.query.wallets.findFirst({ where: eq(schema.wallets.userId, userId) });
  return w?.balanceSatang ?? 0;
}
