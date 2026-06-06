import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getBalance } from "@/lib/credit/ledger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const balance = await getBalance(auth.userId);
  return NextResponse.json({ ok: true, balance_satang: balance, balance_baht: balance / 100 });
}
