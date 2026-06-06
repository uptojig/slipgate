import { tmnCall, type TmnCallResult } from "./client";

/**
 * Account-scoped service APIs exposed under
 * `https://apis.truemoneyservices.com/account/v1/*`.
 *
 * Each menu has its own bearer token issued in the TrueMoney app:
 *   • my-last-receive   → TMN_LAST_RECEIVE_TOKEN
 *   • balance           → TMN_BALANCE_TOKEN (future)
 *   • received-transfer → TMN_RECEIVED_TRANSFER_TOKEN (future)
 */

const BASE = "https://apis.truemoneyservices.com/account/v1";

/**
 * Latest received transaction. Returns ONE most recent event.
 *
 * `amount` is satang (integer) — e.g. 5025 = 50.25 baht.
 * Field names use either `_number` (per official doc) or `_mobile`
 * (observed in the in-app preview); we normalise to both.
 */
export type MyLastReceive = {
  event_type: "P2P" | string;
  amount: number;                   // satang
  sender_number?: string;
  sender_mobile?: string;
  receiver_number?: string;
  receiver_mobile?: string;
  received_time: string;            // "YYYY-MM-DD HH:mm:ss" in Asia/Bangkok
  transaction_id: string;
  message?: string;
};

export type NormalisedReceive = {
  eventType: string;
  amountSatang: number;
  senderMobile: string | null;
  receiverMobile: string | null;
  receivedTime: string;
  transactionId: string;
  message: string | null;
};

export async function getMyLastReceive(
  token = process.env.TMN_LAST_RECEIVE_TOKEN,
): Promise<TmnCallResult<MyLastReceive>> {
  return tmnCall<MyLastReceive>({
    method: "GET",
    url: `${BASE}/my-last-receive`,
    token,
  });
}

/**
 * Current TrueMoney Wallet balance for the account that owns the token.
 *   GET https://apis.truemoneyservices.com/account/v1/balance
 *
 * `balance` is a string of satang — "20010" = 200.10 baht.
 *
 * Config: `TMN_BALANCE_TOKEN`
 */
export type BalanceData = {
  balance: string;       // satang as string
  mobile_no: string;
  updated_at: string;    // "yyyy-mm-dd HH:mm:ss"
};

export type NormalisedBalance = {
  balanceSatang: number;
  mobileNo: string;
  updatedAt: string;
};

export async function getMyBalance(
  token = process.env.TMN_BALANCE_TOKEN,
): Promise<TmnCallResult<BalanceData>> {
  return tmnCall<BalanceData>({
    method: "GET",
    url: `${BASE}/balance`,
    token,
  });
}

export function normaliseBalance(b: BalanceData): NormalisedBalance {
  return {
    balanceSatang: Number(b.balance),
    mobileNo: b.mobile_no,
    updatedAt: b.updated_at,
  };
}

export function normaliseReceive(p: MyLastReceive): NormalisedReceive {
  return {
    eventType: p.event_type,
    amountSatang: p.amount, // already satang
    senderMobile: p.sender_number ?? p.sender_mobile ?? null,
    receiverMobile: p.receiver_number ?? p.receiver_mobile ?? null,
    receivedTime: p.received_time,
    transactionId: p.transaction_id,
    message: p.message?.trim() ? p.message : null,
  };
}
