import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getBalance } from "@/lib/credit/ledger";
import {
  PRICE_PER_SLIP_SATANG,
  currentYearMonth,
  getQuota,
} from "@/lib/saas/charges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextCycleStart(): string {
  const [y, m] = currentYearMonth().split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 1)).toISOString();
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
      { status: 401 },
    );
  }

  const [quota, balance] = await Promise.all([
    getQuota(auth.userId),
    getBalance(auth.userId),
  ]);

  return NextResponse.json({
    ok: true,
    free_remaining: quota.freeRemaining,
    free_resets_at: nextCycleStart(),
    balance_satang: balance,
    balance_baht: balance / 100,
    price_per_slip_satang: PRICE_PER_SLIP_SATANG,
    sandbox: auth.isSandbox,
  });
}
