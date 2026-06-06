import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBody = z.object({
  enabled: z.boolean().optional(),
  url: z.string().url().max(2048).optional(),
  events: z.array(z.string()).min(1).optional(),
});

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const result = await db
    .delete(schema.customerWebhooks)
    .where(
      and(
        eq(schema.customerWebhooks.id, id),
        eq(schema.customerWebhooks.userId, auth.userId),
      ),
    )
    .returning({ id: schema.customerWebhooks.id });

  if (result.length === 0) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "BAD_BODY", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
  if (parsed.data.url !== undefined) patch.url = parsed.data.url;
  if (parsed.data.events !== undefined) patch.events = parsed.data.events;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "EMPTY_PATCH" }, { status: 400 });
  }

  const updated = await db
    .update(schema.customerWebhooks)
    .set(patch)
    .where(
      and(
        eq(schema.customerWebhooks.id, id),
        eq(schema.customerWebhooks.userId, auth.userId),
      ),
    )
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const h = updated[0];
  return NextResponse.json({
    ok: true,
    webhook: {
      id: h.id,
      url: h.url,
      events: h.events,
      enabled: h.enabled,
      last_delivery_at: h.lastDeliveryAt,
      last_delivery_status: h.lastDeliveryStatus,
      failure_count: h.failureCount,
    },
  });
}
