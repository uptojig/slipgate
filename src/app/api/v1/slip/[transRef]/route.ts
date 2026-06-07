import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { recordUsage } from "@/lib/saas/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

/**
 * GET /api/v1/slip/{transRef}
 *
 * Returns a previously stored slip by transRef. Scoped to the caller's
 * userId so customer A can't read customer B's slip data. No credit
 * charge — reads are free; only verify/parse calls bill.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ transRef: string }> },
) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  const { transRef } = await ctx.params;
  const decoded = decodeURIComponent(transRef ?? "").trim();
  if (!decoded) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELD", message: "transRef is required" },
      { status: 400 },
    );
  }

  const slip = await db.query.slips.findFirst({
    where: and(eq(schema.slips.transRef, decoded), eq(schema.slips.userId, auth.userId)),
  });

  await recordUsage({
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    endpoint: "slip.retrieve",
    units: 0,
    chargedSatang: 0,
    sandbox: auth.isSandbox,
    success: Boolean(slip),
    errorCode: slip ? null : "NOT_FOUND",
    durationMs: Date.now() - start,
    metadata: { transRef: decoded },
  });

  if (!slip) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: `No slip found for transRef ${decoded}` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: slip.id,
      trans_ref: slip.transRef,
      method: slip.method,
      verified: slip.verified,
      amount_satang: slip.amountSatang,
      source_bank: slip.sourceBank,
      target_bank: slip.targetBank,
      source_name: slip.sourceName,
      target_name: slip.targetName,
      source_account: slip.sourceAccount,
      target_account: slip.targetAccount,
      datetime: slip.slipDatetime?.toISOString() ?? null,
      created_at: slip.createdAt?.toISOString() ?? null,
    },
  });
}
