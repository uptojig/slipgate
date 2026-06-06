import { NextRequest, NextResponse } from "next/server";
import { POST as truemoneyPOST, GET as truemoneyGET, HEAD as truemoneyHEAD } from "@/app/api/webhook/truemoney/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shorter webhook alias: /webhook/u/<userId>
 *
 * Some webhook providers reject long URLs or URLs with query strings.
 * This alias forwards to /api/webhook/truemoney with ?u=<userId> injected.
 */
export async function GET() {
  return truemoneyGET();
}

export async function HEAD() {
  return truemoneyHEAD();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  const { uid } = await ctx.params;
  const url = new URL(req.url);
  url.pathname = "/api/webhook/truemoney";
  url.searchParams.set("u", uid);
  // Re-construct as NextRequest by copying body/headers/method to the rewritten URL.
  const headers = new Headers(req.headers);
  const body = await req.text();
  const rewritten = new NextRequest(url.toString(), {
    method: "POST",
    headers,
    body,
  });
  return truemoneyPOST(rewritten);
}
