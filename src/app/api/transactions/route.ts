import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { authenticateApiRequest } from "@/lib/api-auth";
import { db, schema } from "@/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 200);
  const kind = req.nextUrl.searchParams.get("kind") as
    | typeof schema.txKindEnum.enumValues[number]
    | null;

  const where = kind
    ? and(eq(schema.transactions.userId, auth.userId), eq(schema.transactions.kind, kind))
    : eq(schema.transactions.userId, auth.userId);

  const rows = await db.query.transactions.findMany({
    where,
    orderBy: [desc(schema.transactions.createdAt)],
    limit,
  });

  return NextResponse.json({
    ok: true,
    count: rows.length,
    transactions: rows.map((tx) => ({
      id: tx.id,
      kind: tx.kind,
      status: tx.status,
      amount_satang: tx.amountSatang,
      amount_baht: tx.amountSatang / 100,
      external_ref: tx.externalRef,
      source: tx.source,
      note: tx.note,
      created_at: tx.createdAt,
    })),
  });
}
