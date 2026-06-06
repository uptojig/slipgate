/**
 * TrueMoney Voucher (อั่งเปา) redemption — public endpoint used by the
 * TrueMoney web UI at https://gift.truemoney.com/campaign/?v=<hash>.
 *
 * This is the same JSON endpoint the public mobile/web claim page hits;
 * it does NOT require any merchant onboarding. The user pastes either:
 *   • the full gift URL → we extract the `v=` parameter
 *   • just the 35-char voucher hash
 *
 * NOTE: TrueMoney may rotate endpoints or impose rate limits. Wrap calls
 * in try/catch and surface their error code (status.code) back to the user.
 */

const ENDPOINT = "https://gift.truemoney.com/campaign/vouchers";

export type RedeemSuccess = {
  ok: true;
  amountSatang: number;
  voucherCode: string;
  rawAmount: string;
  raw: unknown;
};

export type RedeemFailure = {
  ok: false;
  code: string;
  message: string;
  raw?: unknown;
};

export type RedeemResult = RedeemSuccess | RedeemFailure;

export function extractVoucherCode(input: string): string | null {
  const trimmed = input.trim();
  // full URL form
  const url = trimmed.match(/[?&]v=([A-Za-z0-9]+)/);
  if (url) return url[1] ?? null;
  // bare hash (TrueMoney voucher hashes are alphanumeric, ~35 chars)
  if (/^[A-Za-z0-9]{20,64}$/.test(trimmed)) return trimmed;
  return null;
}

export async function redeemVoucher(input: {
  code: string;
  mobileNumber: string; // claimer's TrueMoney phone (10 digits, starts with 0)
}): Promise<RedeemResult> {
  const url = `${ENDPOINT}/${encodeURIComponent(input.code)}/redeem`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ mobile: input.mobileNumber, voucher_hash: input.code }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: (e as Error).message };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "BAD_RESPONSE", message: `HTTP ${res.status}` };
  }

  // TrueMoney response shape:
  // { status: { code: "SUCCESS"|..., message: "..." }, data: { voucher: { amount_baht: "100.00" }, ... } }
  const obj = json as {
    status?: { code?: string; message?: string };
    data?: { voucher?: { amount_baht?: string }; my_ticket?: { amount_baht?: string } };
  };

  const code = obj.status?.code ?? "UNKNOWN";
  if (code !== "SUCCESS") {
    return {
      ok: false,
      code,
      message: obj.status?.message ?? "Voucher redemption failed",
      raw: json,
    };
  }

  const amountBaht =
    obj.data?.voucher?.amount_baht ??
    obj.data?.my_ticket?.amount_baht ??
    "0";

  return {
    ok: true,
    voucherCode: input.code,
    rawAmount: amountBaht,
    amountSatang: Math.round(Number(amountBaht) * 100),
    raw: json,
  };
}
