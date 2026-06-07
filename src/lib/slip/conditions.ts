/**
 * Optional verification conditions a caller can attach to a slip-verify
 * request to assert business rules in addition to the raw OCR/QR result.
 *
 * Modelled after Slip2Go's `checkCondition` shape so customers can migrate
 * with minimal code change.
 *
 *   - checkDuplicate   reject if the transRef was already seen (replay).
 *   - checkReceiver[]  array of acceptable receivers; passes when ANY entry
 *                      matches (OR semantics — Slip2Go behaviour).
 *   - checkAmount      compare parsed amount against an expected value with
 *                      `eq | lte | gte` operator (default `eq`).
 *   - checkDate        compare parsed datetime against an expected ISO date
 *                      with the same operator family. Day-granularity for
 *                      `eq` so a 14:48 vs 14:49 minute drift doesn't fail.
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ParsedSlip } from "@/lib/slip/core";

export type CompareOp = "eq" | "lte" | "gte";

export type CheckReceiver = {
  accountType?: string;       // bank code, e.g. "01002" or "KBANK"
  accountNameTH?: string;
  accountNameEN?: string;
  accountNumber?: string;
};

export type CheckCondition = {
  checkDuplicate?: boolean;
  checkReceiver?: CheckReceiver[];
  checkAmount?: { type?: CompareOp; amount: string | number };
  checkDate?: { type?: CompareOp; date: string };
};

export type ConditionResult =
  | { check: "duplicate"; passed: boolean; reason?: string }
  | { check: "receiver"; passed: boolean; matchedIndex?: number; reason?: string }
  | { check: "amount"; passed: boolean; expected: number; actual: number | null; type: CompareOp }
  | { check: "date"; passed: boolean; expected: string; actual: string | null; type: CompareOp };

export type ValidationResult = {
  passed: boolean;             // overall — all enabled checks passed
  checks: ConditionResult[];   // per-check breakdown
};

/**
 * Loose Thai/EN name normaliser — strips honorifics, spaces, punctuation,
 * lowercases. Mirrors Slip2Go's "ห้ามใส่คำนำหน้า" guidance.
 */
function normaliseName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFC")
    .replace(/^(นาย|นางสาว|น\.ส\.|นาง|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss\.?)\s*/i, "")
    .replace(/[\s.\-,]/g, "")
    .toLowerCase();
}

/** Strip non-digits — used for masked-vs-real account number matching. */
function digitsOnly(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\D+/g, "");
}

/**
 * Compare a normalised account-number candidate against the masked value
 * actually visible on the slip (e.g. "xxx-x-x4442-x" vs "xxxxxx1234").
 * We treat the inputs as "last-N digits match" since most slips redact the
 * middle of the number.
 */
function accountNumberMatches(expected: string, actual: string): boolean {
  const e = digitsOnly(expected);
  const a = digitsOnly(actual);
  if (!e || !a) return false;
  const tail = Math.min(e.length, a.length, 4);
  return tail >= 3 && e.slice(-tail) === a.slice(-tail);
}

function compareNumeric(actual: number | null, expected: number, op: CompareOp): boolean {
  if (actual == null) return false;
  if (op === "lte") return actual <= expected;
  if (op === "gte") return actual >= expected;
  return actual === expected;
}

function compareDate(actual: string | null, expected: string, op: CompareOp): boolean {
  if (!actual) return false;
  const a = new Date(actual).getTime();
  const e = new Date(expected).getTime();
  if (Number.isNaN(a) || Number.isNaN(e)) return false;
  if (op === "lte") return a <= e;
  if (op === "gte") return a >= e;
  // eq → match on calendar day (Asia/Bangkok); minute-granularity drift on
  // OCR'd timestamps would otherwise cause spurious failures.
  return dayKey(a) === dayKey(e);
}

function dayKey(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000); // shift to ICT
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function matchReceiver(parsed: ParsedSlip, r: CheckReceiver): boolean {
  if (r.accountType) {
    const actual = (parsed.targetBank ?? "").toUpperCase();
    const want = r.accountType.toUpperCase();
    // accept either a bank code ("01002") or a code name ("KBANK")
    if (actual !== want && !actual.includes(want) && !want.includes(actual)) return false;
  }
  if (r.accountNameTH) {
    if (normaliseName(parsed.targetName) !== normaliseName(r.accountNameTH)) return false;
  }
  if (r.accountNameEN) {
    if (normaliseName(parsed.targetName) !== normaliseName(r.accountNameEN)) return false;
  }
  if (r.accountNumber) {
    if (!accountNumberMatches(r.accountNumber, parsed.targetAccount ?? "")) return false;
  }
  return true;
}

export async function evaluateConditions(
  parsed: ParsedSlip,
  conditions: CheckCondition | undefined,
  ctx: { userId: string | null },
): Promise<ValidationResult> {
  const checks: ConditionResult[] = [];
  if (!conditions) return { passed: true, checks };

  // checkDuplicate
  if (conditions.checkDuplicate) {
    let dup = false;
    let reason: string | undefined;
    if (!parsed.transRef) {
      reason = "no transRef parsed — cannot dedupe";
    } else {
      const where = ctx.userId
        ? and(eq(schema.slips.transRef, parsed.transRef), eq(schema.slips.userId, ctx.userId))
        : eq(schema.slips.transRef, parsed.transRef);
      const existing = await db.query.slips.findFirst({ where });
      dup = Boolean(existing);
    }
    checks.push({ check: "duplicate", passed: !dup, reason: dup ? "transRef already seen" : reason });
  }

  // checkReceiver — OR semantics across array
  if (conditions.checkReceiver?.length) {
    let matchedIndex: number | undefined;
    for (let i = 0; i < conditions.checkReceiver.length; i++) {
      if (matchReceiver(parsed, conditions.checkReceiver[i])) {
        matchedIndex = i;
        break;
      }
    }
    checks.push({
      check: "receiver",
      passed: matchedIndex !== undefined,
      matchedIndex,
      reason: matchedIndex === undefined ? "no receiver entry matched" : undefined,
    });
  }

  // checkAmount
  if (conditions.checkAmount) {
    const type = conditions.checkAmount.type ?? "eq";
    const expectedSatang = Math.round(Number(conditions.checkAmount.amount) * 100);
    const passed = compareNumeric(parsed.amountSatang, expectedSatang, type);
    checks.push({ check: "amount", passed, expected: expectedSatang, actual: parsed.amountSatang, type });
  }

  // checkDate
  if (conditions.checkDate) {
    const type = conditions.checkDate.type ?? "eq";
    const passed = compareDate(parsed.datetime, conditions.checkDate.date, type);
    checks.push({ check: "date", passed, expected: conditions.checkDate.date, actual: parsed.datetime, type });
  }

  return { passed: checks.every((c) => c.passed), checks };
}
