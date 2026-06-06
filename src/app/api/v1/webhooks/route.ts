import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db, schema } from "@/db";
import { authenticateApiRequest } from "@/lib/api-auth";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN_EVENTS = ["slip.verified"] as const;

const CreateBody = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.enum(KNOWN_EVENTS)).min(1).optional(),
});

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  const hooks = await db.query.customerWebhooks.findMany({
    where: eq(schema.customerWebhooks.userId, auth.userId),
    orderBy: [desc(schema.customerWebhooks.createdAt)],
  });

  return NextResponse.json({
    ok: true,
    webhooks: hooks.map((h) => ({
      id: h.id,
      url: h.url,
      events: h.events,
      enabled: h.enabled,
      last_delivery_at: h.lastDeliveryAt,
      last_delivery_status: h.lastDeliveryStatus,
      failure_count: h.failureCount,
      created_at: h.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "BAD_BODY", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const id = newId("wh");
  // 32 bytes of entropy is overkill for HMAC keying but keeps the secret
  // long enough that customers don't accidentally paste a truncated copy.
  const signingSecret = "whsec_" + randomBytes(32).toString("base64url");
  const events = parsed.data.events ?? ["slip.verified"];

  await db.insert(schema.customerWebhooks).values({
    id,
    userId: auth.userId,
    url: parsed.data.url,
    signingSecret,
    enabled: true,
    events,
  });

  return NextResponse.json(
    {
      ok: true,
      webhook: {
        id,
        url: parsed.data.url,
        events,
        enabled: true,
      },
      signing_secret: signingSecret,
    },
    { status: 201 },
  );
}
