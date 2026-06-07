import jwt from "jsonwebtoken";

/**
 * Schema of incoming events from the official "ทรูมันนี่" app webhook.
 *
 * Delivery shape: `POST { "message": "<JWT HS256 string>" }` to your
 * configured Endpoint URL, with `Authorization: <auth_key>` header.
 *
 * The JWT payload uses two distinct shapes depending on direction:
 *
 *  ── INBOUND (เงินเข้า) ──────────────────────────────────────────────
 *   event_type:
 *     • "P2P"            — โอนเข้าจาก TrueMoney user
 *     • "MONEY_LINK"     — รับซองอั่งเปา (incoming)
 *     • "DIRECT_TOPUP"   — เติมจากร้านค้า/ธนาคาร (channel="7-Eleven"…)
 *     • "PROMPTPAY_IN"   — พร้อมเพย์เข้า
 *   fields: received_time, amount, sender_mobile, sender_name?,
 *           message, channel, transaction_id
 *
 *  ── OUTBOUND (เงินออก) ─────────────────────────────────────────────
 *   event_type:
 *     • "BANK_WITHDRAW"      — โอนเข้าบัญชีธนาคาร (description = เลขบัญชี)
 *     • "SEND_MONEY_PLUS"    — โอนเข้า Money Plus
 *     • "PROMPTPAY_TAG29"    — พร้อมเพย์บุคคลธรรมดา
 *     • "PROMPTPAY_TAG30"    — พร้อมเพย์ร้านค้า
 *     • "SEND_P2P"           — โอนไป TrueMoney user (merchant_name = เบอร์)
 *     • "SEND_MONEY_LINK"    — ส่งซองอั่งเปา (outgoing)
 *     • "FEE_PAYMENT"        — ค่าธรรมเนียม (merchant_name แยกชนิด)
 *   fields: transaction_date, amount, merchant_name, description, transaction_id
 *
 * Amount is ALWAYS satang (integer) — 10000 = 100.00 baht.
 */

export type TmnEventType =
  // inbound
  | "P2P"
  | "MONEY_LINK"
  | "DIRECT_TOPUP"
  | "PROMPTPAY_IN"
  // outbound
  | "BANK_WITHDRAW"
  | "SEND_MONEY_PLUS"
  | "PROMPTPAY_TAG29"
  | "PROMPTPAY_TAG30"
  | "SEND_P2P"
  | "SEND_MONEY_LINK"
  | "FEE_PAYMENT"
  // legacy alias seen in earlier docs
  | "FEE"
  | "WITHDRAW"
  | string;

export const INBOUND_EVENTS = new Set([
  "P2P", "MONEY_LINK", "DIRECT_TOPUP", "PROMPTPAY_IN",
]);

export const OUTBOUND_EVENTS = new Set([
  "BANK_WITHDRAW", "SEND_MONEY_PLUS",
  "PROMPTPAY_TAG29", "PROMPTPAY_TAG30",
  "SEND_P2P", "SEND_MONEY_LINK", "FEE_PAYMENT",
  "FEE", "WITHDRAW",
]);

export type InboundPayload = {
  event_type: TmnEventType;
  received_time: string;
  amount: number;
  sender_mobile?: string;
  sender_name?: string;
  message?: string;
  channel?: string;
  transaction_id?: string;
  iat?: number;
};

export type OutboundPayload = {
  event_type: TmnEventType;
  transaction_date: string;
  amount: number;
  merchant_name?: string;
  description?: string;
  transaction_id?: string;
  iat?: number;
};

export type TmnPayload = (InboundPayload | OutboundPayload) & { [k: string]: unknown };

export type TmnKeyPair = {
  authKey: string;
  jwtSecret: string;
  label?: string; // e.g. "inbound" / "outbound" — surfaces in VerifyResult
};

export type VerifyResult =
  | { ok: true; payload: TmnPayload; matchedLabel?: string }
  | {
      ok: false;
      reason: "MISSING_AUTH" | "BAD_AUTH" | "BAD_BODY" | "BAD_JWT" | "BAD_PAYLOAD";
      detail?: string;
    };

/**
 * Verifies an incoming TMN webhook request against one or more key pairs.
 *
 * Why multiple keys: TMN issues a separate Authorization+JWT secret per
 * webhook registration (e.g. inbound แจ้งรับเงิน/เติมเงิน vs outbound
 * แจ้งหักค่าธรรมเนียม/ถอน). Both webhooks can be configured to POST to the
 * same endpoint, so the receiver must accept either key.
 */
export function verifyTmnRequest(opts: {
  authorizationHeader: string | null;
  rawBody: string;
  keys: TmnKeyPair[];
}): VerifyResult {
  if (!opts.authorizationHeader) return { ok: false, reason: "MISSING_AUTH" };
  if (opts.keys.length === 0) return { ok: false, reason: "BAD_AUTH", detail: "no keys configured" };

  const provided = opts.authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  const matched = opts.keys.find((k) => k.authKey === provided);
  if (!matched) return { ok: false, reason: "BAD_AUTH" };

  let body: unknown;
  try {
    body = JSON.parse(opts.rawBody);
  } catch (e) {
    return { ok: false, reason: "BAD_BODY", detail: (e as Error).message };
  }
  const token = (body as { message?: string })?.message;
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "BAD_BODY", detail: "missing 'message' field" };
  }

  let decoded: unknown;
  try {
    decoded = jwt.verify(token, matched.jwtSecret, { algorithms: ["HS256"] });
  } catch (e) {
    return { ok: false, reason: "BAD_JWT", detail: (e as Error).message };
  }
  if (!decoded || typeof decoded !== "object") return { ok: false, reason: "BAD_PAYLOAD" };

  const p = decoded as Partial<TmnPayload>;
  if (!p.event_type || typeof p.amount !== "number") {
    return { ok: false, reason: "BAD_PAYLOAD", detail: "missing event_type or amount" };
  }
  return { ok: true, payload: p as TmnPayload, matchedLabel: matched.label };
}

/**
 * Collects all configured TMN webhook keys from env, in priority order:
 *   inbound → outbound → legacy single key.
 * Legacy single key stays supported so existing deploys keep working
 * during the rollout.
 */
export function collectTmnKeysFromEnv(env: NodeJS.ProcessEnv = process.env): TmnKeyPair[] {
  const pairs: TmnKeyPair[] = [];

  const inAuth = env.TMN_WEBHOOK_AUTH_KEY_INBOUND;
  const inSecret = env.TMN_WEBHOOK_JWT_SECRET_INBOUND ?? inAuth;
  if (inAuth && inSecret) pairs.push({ authKey: inAuth, jwtSecret: inSecret, label: "inbound" });

  const outAuth = env.TMN_WEBHOOK_AUTH_KEY_OUTBOUND;
  const outSecret = env.TMN_WEBHOOK_JWT_SECRET_OUTBOUND ?? outAuth;
  if (outAuth && outSecret) pairs.push({ authKey: outAuth, jwtSecret: outSecret, label: "outbound" });

  // Legacy single-key config (kept for backward compat).
  const legacyAuth = env.TMN_WEBHOOK_AUTH_KEY;
  const legacySecret = env.TMN_WEBHOOK_JWT_SECRET ?? legacyAuth;
  if (legacyAuth && legacySecret) pairs.push({ authKey: legacyAuth, jwtSecret: legacySecret, label: "legacy" });

  return pairs;
}

export type LedgerKind = "tmn_incoming" | "tmn_topup" | "tmn_voucher" | "withdraw" | "adjust";

export function tmnEventToLedgerKind(event: TmnEventType): {
  kind: LedgerKind | null;
  direction: "in" | "out";
} {
  switch (event) {
    case "P2P":
      return { kind: "tmn_incoming", direction: "in" };
    case "MONEY_LINK":
      return { kind: "tmn_voucher", direction: "in" };
    case "DIRECT_TOPUP":
    case "PROMPTPAY_IN":
      return { kind: "tmn_topup", direction: "in" };
    case "BANK_WITHDRAW":
    case "SEND_MONEY_PLUS":
    case "SEND_P2P":
    case "SEND_MONEY_LINK":
    case "PROMPTPAY_TAG29":
    case "PROMPTPAY_TAG30":
    case "WITHDRAW":
      return { kind: "withdraw", direction: "out" };
    case "FEE_PAYMENT":
    case "FEE":
      return { kind: "adjust", direction: "out" };
    default:
      return { kind: null, direction: "out" };
  }
}

/**
 * Normalises both inbound and outbound payloads into a common shape so
 * downstream code can write a single ledger row.
 */
export type NormalisedTmnEvent = {
  externalRef: string;
  eventType: TmnEventType;
  amountSatang: number;            // signed: + for inbound, − for outbound
  direction: "in" | "out";
  occurredAt: string;
  counterpartyName: string | null;  // sender_name OR merchant_name
  counterpartyMobile: string | null; // sender_mobile OR (for SEND_P2P) merchant_name digits
  note: string | null;
  channel: string | null;
  feeCategory: string | null;       // for FEE_PAYMENT only
};

export function normaliseTmnPayload(p: TmnPayload): NormalisedTmnEvent {
  const { direction, kind } = tmnEventToLedgerKind(p.event_type);
  const isOutbound = direction === "out";

  // Outbound shape
  const outbound = isOutbound ? (p as OutboundPayload) : null;
  // Inbound shape
  const inbound = !isOutbound ? (p as InboundPayload) : null;

  const occurredAt = outbound?.transaction_date ?? inbound?.received_time ?? "";

  const externalRef = p.transaction_id
    ? p.transaction_id
    : `${p.event_type}:${occurredAt}:${p.amount}`;

  let counterpartyName: string | null = null;
  let counterpartyMobile: string | null = null;
  let note: string | null = null;
  let feeCategory: string | null = null;

  if (inbound) {
    counterpartyName = inbound.sender_name ?? null;
    counterpartyMobile = inbound.sender_mobile ?? null;
    note = inbound.message?.trim() || null;
  } else if (outbound) {
    counterpartyName = outbound.merchant_name?.trim() || null;
    // SEND_P2P uses merchant_name as the destination phone
    if (p.event_type === "SEND_P2P" && /^\d{9,10}$/.test(outbound.merchant_name ?? "")) {
      counterpartyMobile = outbound.merchant_name!;
    }
    note = outbound.description?.trim() || null;
    if (p.event_type === "FEE_PAYMENT") feeCategory = outbound.merchant_name ?? null;
  }

  return {
    externalRef,
    eventType: p.event_type,
    amountSatang: isOutbound ? -Math.abs(p.amount) : p.amount,
    direction,
    occurredAt,
    counterpartyName,
    counterpartyMobile,
    note,
    channel: (inbound?.channel?.trim() || null) ?? null,
    feeCategory,
  };
}
