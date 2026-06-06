import jsQR from "jsqr";
import sharp from "sharp";

/**
 * Decodes the QR code embedded in a Thai bank/TrueMoney slip image.
 *
 * Banks encode their PromptPay slip QR in EMVCo TLV (Tag-Length-Value)
 * format. The payload contains fields like:
 *   • bank codes (sender/receiver)
 *   • masked account numbers
 *   • transaction reference
 *   • amount
 *
 * This function only returns the raw QR string; structured parsing
 * happens in `parser.ts`.
 */
export async function decodeSlipQr(input: Buffer): Promise<string | null> {
  // Pre-process: convert to grayscale raw RGBA, downscale large slips.
  const meta = await sharp(input).metadata();
  const maxDim = 1600;
  let pipeline = sharp(input);
  if ((meta.width ?? 0) > maxDim || (meta.height ?? 0) > maxDim) {
    pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: "inside" });
  }
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: "attemptBoth",
  });
  return code?.data ?? null;
}
