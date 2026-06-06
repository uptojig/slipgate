import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
export async function POST() {
  return NextResponse.json({ ok: true, received: true });
}
