import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  uniqueIndex,
  index,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────
export const txKindEnum = pgEnum("tx_kind", [
  "tmn_incoming",     // โอนเงินเข้า TrueWallet
  "tmn_topup",        // เติมเงินจากธนาคาร/พร้อมเพย์เข้า TrueWallet
  "tmn_voucher",      // รับซองอั่งเปา
  "bank_slip",        // เติมจากสลิปธนาคาร (verified ด้วย OCR)
  "withdraw",         // ถอนออก
  "adjust",           // admin ปรับยอด
]);

export const txStatusEnum = pgEnum("tx_status", [
  "pending",
  "success",
  "failed",
  "reversed",
]);

export const withdrawStatusEnum = pgEnum("withdraw_status", [
  "requested",
  "approved",
  "rejected",
  "paid",
  "cancelled",
]);

// ── Auth ───────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    role: text("role").notNull().default("user"), // 'user' | 'admin'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ── API keys (for users to call our API server-to-server) ─────────────
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),  // first 8 chars for display
    keyHash: text("key_hash").notNull(),      // sha256(full key)
    /**
     * Sandbox keys (sk_test_*) don't charge credits and don't call
     * downstream TrueMoney/AI services. They return deterministic
     * mock data so customers can integrate without spending money.
     */
    isSandbox: boolean("is_sandbox").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("api_keys_hash_idx").on(t.keyHash),
    index("api_keys_user_idx").on(t.userId),
  ],
);

// ── Usage events (every billable API call) ────────────────────────────
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    apiKeyId: text("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    endpoint: text("endpoint").notNull(),     // 'slip.verify', 'slip.bulk', 'tmn.validate', etc.
    units: integer("units").notNull().default(1),  // # of slips processed in this call
    chargedSatang: bigint("charged_satang", { mode: "number" }).notNull().default(0),
    sandbox: boolean("sandbox").notNull().default(false),
    success: boolean("success").notNull().default(true),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_user_day_idx").on(t.userId, t.createdAt),
    index("usage_endpoint_idx").on(t.endpoint),
  ],
);

// ── Customer-side webhooks ────────────────────────────────────────────
// Customers register their own webhook URL so we POST verification
// results back to their server (so they don't need to poll our API).
export const customerWebhooks = pgTable(
  "customer_webhooks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Customer-chosen secret for HMAC-SHA256 signing of webhook body */
    signingSecret: text("signing_secret").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    events: jsonb("events").notNull().default(["slip.verified"]),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    lastDeliveryStatus: integer("last_delivery_status"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_webhooks_user_idx").on(t.userId)],
);

// ── Per-user SaaS counters (free quota etc.) ──────────────────────────
export const userQuotas = pgTable(
  "user_quotas",
  {
    userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    /** Monthly free slips remaining — reset on the 1st of each month */
    freeRemaining: integer("free_remaining").notNull().default(100),
    /** Counter reset cycle, "YYYY-MM" */
    cycleKey: text("cycle_key").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

// ── Wallet (credit balance, satang) ───────────────────────────────────
export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    balanceSatang: bigint("balance_satang", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallets_user_idx").on(t.userId)],
);

// ── Transactions / Ledger ─────────────────────────────────────────────
export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: txKindEnum("kind").notNull(),
    status: txStatusEnum("status").notNull().default("pending"),
    amountSatang: bigint("amount_satang", { mode: "number" }).notNull(),
    feeSatang: bigint("fee_satang", { mode: "number" }).notNull().default(0),
    // external reference (e.g. TMN transaction_id, voucher hash, slip ref)
    externalRef: text("external_ref"),
    // optional source identifier (e.g. sender phone/name, bank, voucher code)
    source: text("source"),
    note: text("note"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tx_user_idx").on(t.userId),
    index("tx_kind_idx").on(t.kind),
    uniqueIndex("tx_external_ref_idx").on(t.kind, t.externalRef),
  ],
);

// ── TrueMoney webhook event log (idempotency + audit) ─────────────────
export const tmnEvents = pgTable(
  "tmn_events",
  {
    id: text("id").primaryKey(),
    // transaction_id from JWT payload — unique to prevent double-credit
    transactionId: text("transaction_id").notNull(),
    eventType: text("event_type").notNull(), // 'incoming' | 'topup' | 'fee' | 'withdraw'
    rawPayload: jsonb("raw_payload").notNull(),
    matchedUserId: text("matched_user_id").references(() => users.id, { onDelete: "set null" }),
    matchedTransactionId: text("matched_tx_id").references(() => transactions.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tmn_events_txid_idx").on(t.transactionId)],
);

// ── Slip verification log ─────────────────────────────────────────────
export const slips = pgTable(
  "slips",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    method: text("method").notNull(), // 'qr' | 'ocr' | 'easyslip'
    sourceBank: text("source_bank"),
    targetBank: text("target_bank"),
    sourceAccount: text("source_account"),
    targetAccount: text("target_account"),
    sourceName: text("source_name"),
    targetName: text("target_name"),
    amountSatang: bigint("amount_satang", { mode: "number" }),
    slipDatetime: timestamp("slip_datetime", { withTimezone: true }),
    transRef: text("trans_ref"),     // bank transaction reference
    qrPayload: text("qr_payload"),   // raw QR string
    raw: jsonb("raw"),
    verified: boolean("verified").notNull().default(false),
    creditedTxId: text("credited_tx_id").references(() => transactions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("slips_trans_ref_idx").on(t.transRef),
    index("slips_user_idx").on(t.userId),
  ],
);

// ── Vouchers (TrueMoney อั่งเปา) ──────────────────────────────────────
export const vouchers = pgTable(
  "vouchers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    voucherHash: text("voucher_hash").notNull(),
    receiverPhone: text("receiver_phone"),  // phone used to claim (if known)
    amountSatang: bigint("amount_satang", { mode: "number" }),
    status: text("status").notNull(),       // 'redeemed' | 'failed' | 'duplicate' | 'expired'
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    raw: jsonb("raw"),
    creditedTxId: text("credited_tx_id").references(() => transactions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("vouchers_hash_idx").on(t.voucherHash),
    index("vouchers_user_idx").on(t.userId),
  ],
);

// ── Withdrawals ───────────────────────────────────────────────────────
export const withdrawals = pgTable(
  "withdrawals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountSatang: bigint("amount_satang", { mode: "number" }).notNull(),
    feeSatang: bigint("fee_satang", { mode: "number" }).notNull().default(0),
    method: text("method").notNull(),       // 'tmn' | 'bank'
    destAccount: text("dest_account").notNull(),
    destName: text("dest_name"),
    destBank: text("dest_bank"),
    status: withdrawStatusEnum("status").notNull().default("requested"),
    txId: text("tx_id").references(() => transactions.id, { onDelete: "set null" }),
    adminNote: text("admin_note"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("withdrawals_user_idx").on(t.userId)],
);
