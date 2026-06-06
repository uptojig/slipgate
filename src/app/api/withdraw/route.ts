import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { db, schema } from "@/db";
import { getBalance } from "@/lib/credit/ledger";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const Body = z.object({
  amount_satang: z.number().int().min(2000), // 20 baht min
  method: z.enum(["tmn", "bank"]),
  dest_account: z.string().min(1),
  dest_name: z.string().optional(),
  dest_bank: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const rows = await db.query.withdrawals.findMany({
    where: eq(schema.withdrawals.userId, auth.userId),
    orderBy: [desc(schema.withdrawals.createdAt)],
    limit: 50,
  });
  return NextResponse.json({ ok: true, withdrawals: rows });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "BAD_INPUT", issues: parsed.error.issues }, { status: 400 });
  }

  const balance = await getBalance(auth.userId);
  if (balance < parsed.data.amount_satang) {
    return NextResponse.json({ ok: false, error: "INSUFFICIENT_BALANCE", balance_satang: balance }, { status: 400 });
  }

  const id = newId("wd");
  await db.insert(schema.withdrawals).values({
    id,
    userId: auth.userId,
    amountSatang: parsed.data.amount_satang,
    method: parsed.data.method,
    destAccount: parsed.data.dest_account,
    destName: parsed.data.dest_name ?? null,
    destBank: parsed.data.dest_bank ?? null,
    status: "requested",
  });

  return NextResponse.json({ ok: true, withdrawal_id: id, status: "requested" });
}
