import { NextRequest, NextResponse } from "next/server";
import { extractVoucherCode } from "@/lib/truemoney/voucher";

export const runtime = "nodejs";

/**
 * GET /api/voucher/info?link=<gift link or hash>
 *
 * Lightweight helper that extracts the voucher hash from a gift URL
 * without redeeming it. Useful for client-side validation before
 * the user confirms.
 */
export async function GET(req: NextRequest) {
  const link = req.nextUrl.searchParams.get("link");
  if (!link) return NextResponse.json({ ok: false, error: "MISSING_LINK" }, { status: 400 });
  const code = extractVoucherCode(link);
  if (!code) return NextResponse.json({ ok: false, error: "INVALID_FORMAT" }, { status: 400 });
  return NextResponse.json({
    ok: true,
    voucher_code: code,
    redeem_url: `https://gift.truemoney.com/campaign/?v=${code}`,
  });
}
