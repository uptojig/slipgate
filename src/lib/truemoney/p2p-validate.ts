import { tmnCall } from "./client";

/**
 * Verifies a TrueMoney P2P transfer via the official endpoint
 *   POST https://apis.truemoneyservices.com/validate/v1/p2p
 *
 * This is a VERIFICATION API, not a lookup. The caller must already
 * know the 5 slip fields (we obtain them from the slip image / QR /
 * user input). The API responds with one of:
 *
 *   { match_type: "confirmed", message: "Transaction successfully verified" }
 *   { match_type: "found",     message: "transaction_id_missing: accuracy reduced" }
 *
 * Notes from official docs:
 *   • `amount` is satang (integer) — 20025 = 200.25 ฿
 *   • `receiver_mobile` is matched on the last 4 digits only —
 *     you can send "0000001234" if you don't know the first 6.
 *   • `sender_mobile` is optional; send empty string when unknown.
 *   • `transaction_date` format: "yyyy-mm-dd HH:mm" or "yyyy-mm-dd HH".
 *   • Look-back window: 180 days max.
 *
 * Config: `TMN_P2P_VALIDATE_TOKEN`
 */

const ENDPOINT = "https://apis.truemoneyservices.com/validate/v1/p2p";

export type P2PValidateInput = {
  /** sender phone — 10 digits, or "" if unknown */
  sender_mobile?: string;
  /** receiver phone — 10 digits; only last 4 are matched */
  receiver_mobile: string;
  /** TrueMoney transaction id from the slip (highest accuracy when present) */
  transaction_id: string;
  /** amount in satang (integer) — 20025 = 200.25 baht */
  amount_satang: number;
  /** "yyyy-mm-dd HH:mm" or "yyyy-mm-dd HH" — within last 180 days */
  transaction_date: string;
};

export type P2PValidateData = {
  match_type: "confirmed" | "found";
  message: string;
};

export type P2PValidateResult =
  | {
      ok: true;
      matchType: "confirmed" | "found";
      message: string;
      raw: unknown;
    }
  | { ok: false; code: string; message: string; status?: number; raw?: unknown };

export async function validateTmnP2P(input: P2PValidateInput): Promise<P2PValidateResult> {
  if (!input.receiver_mobile || !input.transaction_id) {
    return { ok: false, code: "BAD_INPUT", message: "receiver_mobile + transaction_id required" };
  }
  if (!Number.isInteger(input.amount_satang) || input.amount_satang <= 0) {
    return { ok: false, code: "BAD_INPUT", message: "amount_satang must be a positive integer" };
  }
  if (!/^\d{4}-\d{2}-\d{2} \d{2}(:\d{2})?$/.test(input.transaction_date)) {
    return { ok: false, code: "BAD_INPUT", message: "transaction_date must be yyyy-mm-dd HH:mm or yyyy-mm-dd HH" };
  }

  const res = await tmnCall<P2PValidateData>({
    method: "POST",
    url: ENDPOINT,
    token: process.env.TMN_P2P_VALIDATE_TOKEN,
    body: {
      sender_mobile: input.sender_mobile ?? "",
      receiver_mobile: input.receiver_mobile,
      transaction_id: input.transaction_id,
      amount: input.amount_satang,
      transaction_date: input.transaction_date,
    },
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message, status: res.status, raw: res.raw };
  }

  return {
    ok: true,
    matchType: res.data.match_type,
    message: res.data.message,
    raw: res.raw,
  };
}

/**
 * Helper: format a Date into the format the TMN validate endpoint expects.
 * It accepts both "yyyy-mm-dd HH:mm" and "yyyy-mm-dd HH" — we emit the more
 * precise form by default.
 */
export function formatTmnDate(d: Date, withMinute = true): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // Convert to Asia/Bangkok wall-clock time
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return withMinute ? `${date} ${get("hour")}:${get("minute")}` : `${date} ${get("hour")}`;
}
