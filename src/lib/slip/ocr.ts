/**
 * Vision-model OCR fallback for slip images where the QR is missing,
 * blurred, or partially obscured. Uses the Vercel AI Gateway so the
 * caller picks any vision-capable model via env (default Claude Haiku).
 *
 * Reads `AI_GATEWAY_API_KEY` (https://vercel.com/ai-gateway) and
 * `SLIP_OCR_MODEL` (e.g. "anthropic/claude-haiku-4-5", "openai/gpt-4o-mini").
 *
 * If `AI_GATEWAY_API_KEY` is empty, returns `null` so the caller can
 * fall back to QR-only or third-party EasySlip API.
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
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) return null;

  const model = process.env.SLIP_OCR_MODEL ?? "anthropic/claude-haiku-4-5";
  const dataUrl = `data:${mimeType};base64,${imageBytes.toString("base64")}`;

  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
  const content = body.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as SlipOcrResult;
  } catch {
    // try to extract first JSON object
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as SlipOcrResult;
    return null;
  }
}
