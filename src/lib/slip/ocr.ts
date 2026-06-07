/**
 * Vision-model OCR for slip images. QR alone is enough to dedupe (transRef)
 * but the human-readable fields (amount, sender/receiver name, datetime,
 * masked account) only appear visually on the slip and need vision OCR.
 *
 * Calls the Anthropic Messages API directly. Reads:
 *   • `ANTHROPIC_API_KEY` — your sk-ant-… key from console.anthropic.com
 *   • `SLIP_OCR_MODEL`    — model name (default "claude-haiku-4-5")
 *
 * Legacy `AI_GATEWAY_API_KEY` is still honoured as a fallback so existing
 * deploys keep working until the env is migrated.
 *
 * Returns `null` (not throw) when no key is configured so the caller can
 * still serve a QR-only response.
 */

export type SlipOcrResult = {
  amount?: number;
  sourceBank?: string;
  targetBank?: string;
  sourceAccount?: string;
  targetAccount?: string;
  sourceName?: string;
  targetName?: string;
  transRef?: string;
  datetime?: string;
};

const SYSTEM_PROMPT = `You are an OCR engine for Thai bank transfer slips.
Extract the following fields from the slip image and return STRICT JSON with no commentary:

{
  "amount": number (THB),
  "sourceBank": "BBL"|"KBANK"|"KTB"|"TTB"|"SCB"|"BAY"|"GSB"|"KKP"|"CIMBT"|"UOBT"|"TMW"|...,
  "targetBank": same set,
  "sourceAccount": string (masked digits as shown),
  "targetAccount": string,
  "sourceName": string (Thai name as shown),
  "targetName": string,
  "transRef": string (bank reference / transaction id),
  "datetime": ISO-8601 string in Asia/Bangkok timezone
}

If a field is not visible, omit it. Output JSON only.`;

export async function ocrSlipImage(imageBytes: Buffer, mimeType: string): Promise<SlipOcrResult | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (!anthropicKey && !gatewayKey) return null;

  // Anthropic's image API accepts only specific media types. Default to jpeg
  // for anything else (the bytes are still real image data — Anthropic infers).
  const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  const media_type = allowed.has(mimeType) ? mimeType : "image/jpeg";
  const base64 = imageBytes.toString("base64");

  if (anthropicKey) {
    const model = process.env.SLIP_OCR_MODEL?.replace(/^anthropic\//, "") ?? "claude-haiku-4-5";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type, data: base64 } },
              { type: "text", text: "Extract the slip fields as STRICT JSON only — no prose." },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 200)}`);
    }

    const body = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = body.content?.find((b) => b.type === "text")?.text;
    return parseOcrJson(text ?? "");
  }

  // Legacy: Vercel AI Gateway (OpenAI-compatible).
  const model = process.env.SLIP_OCR_MODEL ?? "anthropic/claude-haiku-4-5";
  const dataUrl = `data:${media_type};base64,${base64}`;
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the slip fields as JSON." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI Gateway error ${res.status}: ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parseOcrJson(body.choices?.[0]?.message?.content ?? "");
}

function parseOcrJson(raw: string): SlipOcrResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SlipOcrResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as SlipOcrResult;
      } catch {
        return null;
      }
    }
    return null;
  }
}
