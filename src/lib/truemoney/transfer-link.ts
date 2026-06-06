/**
 * Creates a TrueMoney "receive money" deep link via
 *   POST https://apis.truemoneyservices.com/utils/v1/transfer-link-generator
 *
 * Use this to generate a pay-to-this-number link (and QR by extension)
 * for your store, without exposing the destination account number.
 *
 * Constraints from official docs:
 *   • mobile_number: 10 digits, digits only
 *   • amount: string in baht, up to 2 decimals, max 50,000
 *   • message: max 140 characters, optional
 *   • Rate limit: 30 req / 30 sec
 *
 * Response is INCONSISTENT with the rest of apis.truemoneyservices.com:
 * the official example puts `url` at the top level instead of inside
 * `data`. We accept both shapes.
 *
 * Config: `TMN_TRANSFER_LINK_TOKEN`
 */

const ENDPOINT = "https://apis.truemoneyservices.com/utils/v1/transfer-link-generator";

export type TransferLinkInput = {
  /** 10-digit destination phone */
  mobile_number: string;
  /** Amount in baht as a number (we serialise to string) — max 50,000, 2 decimals */
  amount: number;
  /** Optional message attached to the transfer — max 140 chars */
  message?: string;
};

export type TransferLinkResult =
  | { ok: true; url: string; raw: unknown }
  | { ok: false; code: string; message: string; status?: number; raw?: unknown };

export async function createTransferLink(input: TransferLinkInput): Promise<TransferLinkResult> {
  const token = process.env.TMN_TRANSFER_LINK_TOKEN;
  if (!token) {
    return { ok: false, code: "NOT_CONFIGURED", message: "TMN_TRANSFER_LINK_TOKEN is missing" };
  }
  if (!/^\d{10}$/.test(input.mobile_number)) {
    return { ok: false, code: "BAD_INPUT", message: "mobile_number must be 10 digits" };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 50_000) {
    return { ok: false, code: "BAD_INPUT", message: "amount must be 0 < x ≤ 50000 baht" };
  }
  if (input.message && input.message.length > 140) {
    return { ok: false, code: "BAD_INPUT", message: "message must be ≤ 140 characters" };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mobile_number: input.mobile_number,
        amount: input.amount.toFixed(2),
        message: input.message ?? "",
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: (e as Error).message };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "BAD_RESPONSE", status: res.status, message: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const obj = json as { err?: string };
    return {
      ok: false,
      code: res.status === 401 ? "UNAUTHORIZED"
          : res.status === 403 ? "FORBIDDEN"
          : res.status === 429 ? "RATE_LIMITED"
          : `HTTP_${res.status}`,
      status: res.status,
      message: obj.err ?? `HTTP ${res.status}`,
      raw: json,
    };
  }

  // Docs describe `data.url`, but the example shows `url` at top level.
  // Accept both.
  const obj = json as { status?: string; url?: string; data?: { url?: string }; err?: string };
  if (obj.status !== "ok") {
    return { ok: false, code: "ERR_STATUS", message: obj.err ?? "non-ok status", raw: json };
  }
  const url = obj.data?.url ?? obj.url;
  if (!url) {
    return { ok: false, code: "BAD_RESPONSE", message: "missing url in response", raw: json };
  }

  return { ok: true, url, raw: json };
}
