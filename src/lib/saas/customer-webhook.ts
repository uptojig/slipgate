import { and, eq, sql } from "drizzle-orm";
import { createHmac } from "crypto";
import { db, schema } from "@/db";

const DELIVERY_TIMEOUT_MS = 5000;

function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function deliverOne(
  webhook: { id: string; url: string; signingSecret: string },
  event: string,
  body: string,
  signature: string,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  let status: number | null = null;
  let ok = false;
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SlipGate-Event": event,
        "X-SlipGate-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    status = res.status;
    ok = res.ok;
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }

  await db
    .update(schema.customerWebhooks)
    .set({
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: status,
      failureCount: ok
        ? 0
        : sql`${schema.customerWebhooks.failureCount} + 1`,
    })
    .where(eq(schema.customerWebhooks.id, webhook.id))
    .catch(() => {});
}

/**
 * Fire-and-forget delivery of `event` to every enabled customer webhook
 * for `userId` whose `events` array contains the event name. Each request is
 * HMAC-SHA256 signed with the per-webhook secret so receivers can verify
 * authenticity without us holding shared credentials.
 */
export function deliverCustomerWebhook(userId: string, event: string, payload: unknown): void {
  void (async () => {
    const hooks = await db.query.customerWebhooks
      .findMany({
        where: and(
          eq(schema.customerWebhooks.userId, userId),
          eq(schema.customerWebhooks.enabled, true),
        ),
      })
      .catch(() => []);

    if (hooks.length === 0) return;

    const body = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    await Promise.all(
      hooks
        .filter((h) => {
          const events = Array.isArray(h.events) ? (h.events as string[]) : [];
          return events.includes(event);
        })
        .map((h) =>
          deliverOne(
            { id: h.id, url: h.url, signingSecret: h.signingSecret },
            event,
            body,
            signBody(h.signingSecret, body),
          ),
        ),
    );
  })().catch(() => {});
}
