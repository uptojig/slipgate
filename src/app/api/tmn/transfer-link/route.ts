import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getCurrentUser } from "@/lib/auth";
import { createTransferLink } from "@/lib/truemoney/transfer-link";

export const runtime = "nodejs";

const Body = z.object({
  mobile_number: z.string().regex(/^\d{10}$/, "must be 10 digits"),
  amount: z.number().positive().max(50_000),
  message: z.string().max(140).optional(),
});

/**
 * POST /api/tmn/transfer-link
 *
 * Generates a TrueMoney "receive money" deep link via
 * `utils/v1/transfer-link-generator`. Returns a `tmn.app.link` URL that
 * opens the TrueMoney app pre-filled with the recipient phone + amount
 * + message.
 *
 * Use case: e-commerce checkout button → opens TMN app for the customer
 * with exact amount prefilled, no chance of typos.
 *
 * Authentication: session OR Bearer API key.
 */
export async function POST(req: NextRequest) {
  let authed = false;
  if (await getCurrentUser()) authed = true;
  else if (await authenticateApiRequest(req.headers.get("authorization"))) authed = true;

  if (!authed) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "BAD_INPUT", issues: parsed.error.issues }, { status: 400 });
  }

  const res = await createTransferLink(parsed.data);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.code, message: res.message },
      { status: res.status ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: res.url,
    qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(res.url)}`,
  });
}
