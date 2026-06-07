import { desc, eq, and, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { ApiDocsPanel } from "@/components/dashboard/api-docs";

export default async function ApiDocsPage() {
  const user = await requireUser();

  // List of active key *prefixes* so the tester widget can show "you have a
  // sandbox key" cues without ever surfacing the raw value.
  const keys = await db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      isSandbox: schema.apiKeys.isSandbox,
    })
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.userId, user.id), isNull(schema.apiKeys.revokedAt)))
    .orderBy(desc(schema.apiKeys.createdAt));

  return <ApiDocsPanel keyHints={keys} />;
}
