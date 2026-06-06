import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { sha256 } from "@/lib/utils";

/**
 * Resolves an inbound API key (sent as `Authorization: Bearer sk_...`)
 * to its owning user. Returns null if the key is missing, revoked, or unknown.
 *
 * Side effect: updates `lastUsedAt` so users can see when their key was last hit.
 */
export async function authenticateApiRequest(authHeader: string | null) {
  if (!authHeader) return null;
  const raw = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!raw.startsWith("sk_")) return null;

  const keyHash = sha256(raw);
  const row = await db
    .select({
      id: schema.apiKeys.id,
      userId: schema.apiKeys.userId,
      isSandbox: schema.apiKeys.isSandbox,
    })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)))
    .limit(1);

  const key = row[0];
  if (!key) return null;

  // fire-and-forget — don't block the request
  void db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, key.id))
    .catch(() => {});

  return { userId: key.userId, apiKeyId: key.id, isSandbox: key.isSandbox };
}
