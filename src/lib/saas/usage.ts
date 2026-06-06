import { db, schema } from "@/db";
import { newId } from "@/lib/utils";

export type RecordUsageInput = {
  userId: string;
  apiKeyId: string | null;
  endpoint: string;
  units: number;
  chargedSatang: number;
  sandbox: boolean;
  success: boolean;
  errorCode?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordUsage(input: RecordUsageInput): Promise<string> {
  const id = newId("ue");
  await db.insert(schema.usageEvents).values({
    id,
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    endpoint: input.endpoint,
    units: input.units,
    chargedSatang: input.chargedSatang,
    sandbox: input.sandbox,
    success: input.success,
    errorCode: input.errorCode ?? null,
    durationMs: input.durationMs ?? null,
    metadata: input.metadata ?? null,
  });
  return id;
}
