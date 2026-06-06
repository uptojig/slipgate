import { tmnCall } from "./client";

/**
 * Decodes a TrueMoney slip QR into structured transaction info via
 *   POST https://apis.truemoneyservices.com/utils/v1/trans-qr-info
 *
 * The QR string on a TrueMoney slip is a TrueMoney-specific 61-digit
 * payload (not EMVCo PromptPay). This endpoint returns the masked
 * sender/receiver phones, amount (satang), message, and datetime.
 *
 * Note: mobile numbers come back MASKED (089***2345). To verify against
 * the official validate endpoint you'd send "0000002345" as
 * receiver_mobile (which only checks last 4 digits).
 *
 * Config: `TMN_QR_INFO_TOKEN`
 */

const ENDPOINT = "https://apis.truemoneyservices.com/utils/v1/trans-qr-info";

export type QrInfoData = {
  sender_mobile: string;   // masked, e.g. "089***2345"
  receiver_mobile: string; // masked
  amount: string | number; // satang — doc says "number" but example is "string"
  message?: string;
  transaction_date: string; // "yyyy-mm-dd HH:mm"
};

export type QrInfoResult =
  | {
      ok: true;
      senderMobileMasked: string;
      receiverMobileMasked: string;
      receiverLast4: string;
      amountSatang: number;
      message: string | null;
      transactionDate: string;
      raw: unknown;
    }
  | { ok: false; code: string; message: string; status?: number; raw?: unknown };

export async function decodeTmnQr(qrValue: string): Promise<QrInfoResult> {
  if (!qrValue || qrValue.length < 20) {
    return { ok: false, code: "BAD_INPUT", message: "qr_value is too short" };
  }

  const res = await tmnCall<QrInfoData>({
    method: "POST",
    url: ENDPOINT,
    token: process.env.TMN_QR_INFO_TOKEN,
    body: { qr_value: qrValue },
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message, status: res.status, raw: res.raw };
  }

  const d = res.data;
  const amountSatang = typeof d.amount === "number" ? d.amount : Number(d.amount);

  // Extract last 4 digits of the masked receiver mobile so callers can
  // feed it straight into validate/v1/p2p (which checks last 4 only).
  const last4Match = String(d.receiver_mobile).match(/(\d{4})$/);
  const receiverLast4 = last4Match ? last4Match[1]! : "";

  return {
    ok: true,
    senderMobileMasked: d.sender_mobile,
    receiverMobileMasked: d.receiver_mobile,
    receiverLast4,
    amountSatang,
    message: d.message?.trim() ? d.message : null,
    transactionDate: d.transaction_date,
    raw: res.raw,
  };
}
