import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { getMyBalance, normaliseBalance } from "@/lib/truemoney/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tmn/balance
 *
 * Returns the live TrueMoney Wallet balance of the account that owns the
 * configured `TMN_BALANCE_TOKEN`.
 *
 * Authentication: session cookie OR Bearer API key.
 */
export async function GET(req: NextRequest) {
  let authed = false;
  if (await getCurrentUser()) authed = true;
  else if (await authenticateApiRequest(req.headers.get("authorization"))) authed = true;

  if (!authed) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const res = await getMyBalance();
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.code, message: res.message },
      { status: res.code === "RATE_LIMITED" ? 429 : 400 },
    );
  }

  const n = normaliseBalance(res.data);
  return NextResponse.json({
    ok: true,
    balance_satang: n.balanceSatang,
    balance_baht: n.balanceSatang / 100,
    mobile_no: n.mobileNo,
    updated_at: n.updatedAt,
  });
}
