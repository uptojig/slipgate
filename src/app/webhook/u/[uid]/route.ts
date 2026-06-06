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
function rewriteWithU(req: NextRequest, uid: string): NextRequest {
  const url = new URL(req.url);
  url.pathname = "/api/webhook/truemoney";
  url.searchParams.set("u", uid);
  return new NextRequest(url, req as unknown as RequestInit);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  return truemoneyGET();
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  return truemoneyHEAD();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ uid: string }> }) {
  const { uid } = await ctx.params;
  return truemoneyPOST(rewriteWithU(req, uid));
}
