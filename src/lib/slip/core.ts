/**
 * Shared slip-verification core. Takes a raw image buffer and returns the
 * normalised parsed result that every public-facing slip endpoint needs.
 *
 * - Decodes the slip-verify QR (cheap, deterministic, gives us transRef).
 * - Runs vision OCR for the human-visible fields (amount, names, datetime,
 *   masked account numbers).
 * - Merges the two sources into a single ParsedSlip.
 *
 * Side-effects (DB writes, billing, customer webhooks) stay in the route
 * handlers so this module is safe to call from any context.
 */

import { decodeSlipQr } from "@/lib/slip/qr";
import { parseSlipQr, bankNameFromCode, type ParsedSlipQr } from "@/lib/slip/parser";
import { ocrSlipImage, type SlipOcrResult } from "@/lib/slip/ocr";

export type ParsedSlip = {
  method: "qr" | "ocr";
  amountSatang: number | null;
  transRef: string | null;
  sourceBank: string | null;
  targetBank: string | null;
  sourceName: string | null;
  targetName: string | null;
  sourceAccount: string | null;
  targetAccount: string | null;
  datetime: string | null;
  qrPayload: string | null;
  parsedQr: ParsedSlipQr | null;
  ocr: SlipOcrResult | null;
  ocrError: string | null;
};

/**
 * QR-text path — caller already has the raw EMVCo TLV string (read from a
 * physical scanner / external image). No OCR, no QR decode; just parse the
 * payload and fill what we can.
 */
export function parseSlipFromQrText(qrText: string): ParsedSlip {
  const parsedQr = parseSlipQr(qrText);
  const amountSatang =
    typeof parsedQr.amount === "number" ? Math.round(parsedQr.amount * 100) : null;
  return {
    method: "qr",
    amountSatang,
    transRef: parsedQr.transRef ?? null,
    sourceBank: bankNameFromCode(parsedQr.bankCode) ?? null,
    targetBank: null,
    sourceName: null,
    targetName: null,
    sourceAccount: null,
    targetAccount: null,
    datetime: null,
    qrPayload: qrText,
    parsedQr,
    ocr: null,
    ocrError: null,
  };
}

export async function parseSlipBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedSlip> {
  const qrPayload = await decodeSlipQr(buffer).catch(() => null);
  const parsedQr = qrPayload ? parseSlipQr(qrPayload) : null;
  const method: "qr" | "ocr" = parsedQr ? "qr" : "ocr";

  let ocr: SlipOcrResult | null = null;
  let ocrError: string | null = null;
  try {
    ocr = await ocrSlipImage(buffer, mimeType || "image/jpeg");
  } catch (e) {
    ocrError = (e as Error).message;
  }

  let amountSatang: number | null = null;
  if (typeof ocr?.amount === "number") amountSatang = Math.round(ocr.amount * 100);
  else if (typeof parsedQr?.amount === "number") amountSatang = Math.round(parsedQr.amount * 100);

  return {
    method,
    amountSatang,
    transRef: ocr?.transRef ?? parsedQr?.transRef ?? null,
    sourceBank: ocr?.sourceBank ?? bankNameFromCode(parsedQr?.bankCode) ?? null,
    targetBank: ocr?.targetBank ?? null,
    sourceName: ocr?.sourceName ?? null,
    targetName: ocr?.targetName ?? null,
    sourceAccount: ocr?.sourceAccount ?? null,
    targetAccount: ocr?.targetAccount ?? null,
    datetime: ocr?.datetime ?? null,
    qrPayload,
    parsedQr,
    ocr,
    ocrError,
  };
}
