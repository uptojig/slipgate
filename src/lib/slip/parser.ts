/**
 * Parses Thai bank slip QR payloads (EMVCo TLV format used by PromptPay
 * slip verification — the "Thai Bank PromptPay Bill Payment" extension).
 *
 * A typical payload looks like:
 *   00020101021229...5303764540420.005802TH62...6304XXXX
 *
 * The bank-specific subfield (tag 30 or 31, depending on bank) carries:
 *   • AID identifying which slip-verify ecosystem
 *   • Bank code (3 digits)
 *   • Sender/receiver account ref
 *
 * The transaction reference number is encoded inside tag 62 (additional data).
 */

export type ParsedSlipQr = {
  raw: string;
  transRef?: string;
  amount?: number;
  country?: string;
  currency?: string;
  bankCode?: string;
  fields: Record<string, string>;
};

function parseTLV(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < payload.length - 4) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    out[tag] = value;
    i += 4 + len;
  }
  return out;
}

export function parseSlipQr(raw: string): ParsedSlipQr {
  const fields = parseTLV(raw);
  const result: ParsedSlipQr = { raw, fields };

  if (fields["54"]) result.amount = Number(fields["54"]);
  if (fields["58"]) result.country = fields["58"];
  if (fields["53"]) result.currency = fields["53"];

  // bank-specific sub-TLV (Thailand uses tag 30 for QR / 31 for slip verify)
  for (const tag of ["30", "31"]) {
    const v = fields[tag];
    if (!v) continue;
    const sub = parseTLV(v);
    if (sub["02"]) result.bankCode = sub["02"];
  }

  // additional data — tag 62 carries a sub-TLV; sub-tag 07 = reference number
  if (fields["62"]) {
    const additional = parseTLV(fields["62"]);
    if (additional["07"]) result.transRef = additional["07"];
    else if (additional["05"]) result.transRef = additional["05"];
  }

  return result;
}

export const THAI_BANK_CODES: Record<string, string> = {
  "002": "BBL",       // Bangkok Bank
  "004": "KBANK",     // Kasikornbank
  "006": "KTB",       // Krungthai
  "011": "TTB",       // ttb
  "014": "SCB",       // Siam Commercial Bank
  "025": "BAY",       // Krungsri
  "069": "KKP",       // Kiatnakin Phatra
  "022": "CIMBT",     // CIMB Thai
  "024": "UOBT",      // UOB Thai
  "030": "GSB",       // Government Savings Bank
  "033": "GHB",       // Government Housing Bank
  "034": "BAAC",      // Bank for Agriculture
  "066": "ISBT",      // Islamic Bank of Thailand
  "067": "TISCO",     // Tisco
  "071": "TCD",       // Thai Credit Retail
  "073": "LHFG",      // LH Bank
  "098": "SCBT",      // Standard Chartered Thailand
};

export function bankNameFromCode(code?: string): string | undefined {
  if (!code) return undefined;
  return THAI_BANK_CODES[code];
}
