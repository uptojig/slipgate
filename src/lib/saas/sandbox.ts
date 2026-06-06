import { createHash } from "crypto";

const BANK_POOL = ["KBANK", "SCB", "BBL", "KTB", "BAY", "TTB", "TMW", "GSB"] as const;
const NAME_POOL = [
  "นาย สมชาย ใจดี",
  "นางสาว สมหญิง ทองคำ",
  "นาย วิชัย ศรีสุข",
  "นางสาว มาลี ดอกไม้",
  "นาย ประสิทธิ์ ก้าวหน้า",
  "นางสาว ปวีณา จันทร์เพ็ญ",
] as const;

function deterministicInt(seed: string, salt: string, mod: number): number {
  const hex = createHash("sha256").update(`${seed}:${salt}`).digest("hex").slice(0, 8);
  return parseInt(hex, 16) % mod;
}

/**
 * Returns a deterministic fake slip verification result. The shape mirrors the
 * production /v1/slip/verify response so customers can integrate against
 * sandbox keys without their code branching on key type.
 */
export function sandboxSlipResult(seed: string) {
  const amountBaht = 100 + deterministicInt(seed, "amount", 9900) + 0.01 * deterministicInt(seed, "satang", 100);
  const amount_satang = Math.round(amountBaht * 100);

  const sourceIdx = deterministicInt(seed, "src", BANK_POOL.length);
  let targetIdx = deterministicInt(seed, "tgt", BANK_POOL.length);
  if (targetIdx === sourceIdx) targetIdx = (targetIdx + 1) % BANK_POOL.length;

  const sourceNameIdx = deterministicInt(seed, "srcname", NAME_POOL.length);
  let targetNameIdx = deterministicInt(seed, "tgtname", NAME_POOL.length);
  if (targetNameIdx === sourceNameIdx) {
    targetNameIdx = (targetNameIdx + 1) % NAME_POOL.length;
  }

  const refSuffix = createHash("sha256").update(`${seed}:ref`).digest("hex").slice(0, 18).toUpperCase();
  const trans_ref = `SBX${refSuffix}`;

  const minutesAgo = deterministicInt(seed, "time", 60 * 24 * 7);
  const datetime = new Date(Date.now() - minutesAgo * 60_000).toISOString();

  return {
    amount_satang,
    trans_ref,
    source_bank: BANK_POOL[sourceIdx],
    target_bank: BANK_POOL[targetIdx],
    source_name: NAME_POOL[sourceNameIdx],
    target_name: NAME_POOL[targetNameIdx],
    datetime,
    verified: true,
    method: "sandbox" as const,
  };
}
