import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { servePublicSlipVerify } from "@/lib/slip/serve-public";
import type { CheckCondition } from "@/lib/slip/conditions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
    { status: 401 },
  );
}

/**
 * POST /api/v1/slip/verify  — public SaaS endpoint, multipart/form-data
 *   file:        slip image (required, ≤8MB)
 *   webhook:     "1" to fan out slip.verified customer webhook
 *   conditions:  optional JSON string — CheckCondition shape
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiRequest(req.headers.get("authorization"));
  if (!auth) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "BAD_FORM" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  let conditions: CheckCondition | undefined;
  const rawConditions = form.get("conditions");
  if (typeof rawConditions === "string" && rawConditions.trim()) {
    try {
      conditions = JSON.parse(rawConditions) as CheckCondition;
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: "BAD_CONDITIONS", detail: (e as Error).message },
        { status: 400 },
      );
    }
  }

  const fireWebhook = form.get("webhook") === "1" || form.get("webhook") === "true";

  return servePublicSlipVerify({
    auth,
    buffer: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type || "image/jpeg",
    conditions,
    fireWebhook,
    endpoint: "slip.verify",
    start,
  });
}
