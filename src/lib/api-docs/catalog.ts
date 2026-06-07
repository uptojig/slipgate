/**
 * Typed catalogue of every public SlipGate API endpoint. Powers the
 * /dashboard/api-docs page (sidebar list + per-endpoint detail panels +
 * sandbox tester).
 *
 * Adding a new endpoint: append to ENDPOINTS, fill in the request schema
 * rows, and provide a runnable example body. The docs page picks it up
 * automatically — no page-level edits needed.
 */

export type FieldType =
  | "String"
  | "Number"
  | "Boolean"
  | "Object"
  | "Array"
  | "DateISO"
  | "Base64"
  | "URL";

export type FieldRow = {
  key: string;        // dot-notation: "payload.checkCondition.checkAmount.amount"
  type: FieldType;
  description: string;
  example: string;
  required: boolean;
  note?: string;      // extra red-text caveat shown under the description
};

export type RequestExample = {
  label: string;            // "Minimal" | "With checkCondition" | ...
  body: object;
};

export type ResponseExample = {
  status: number;
  label: string;            // "Success" | "Insufficient credit" | ...
  body: object;
};

export type EndpointDoc = {
  id: string;
  group: "Slip Verify" | "PromptPay" | "Account";
  title: string;
  shortDescription: string;
  method: "GET" | "POST";
  path: string;
  authRequired: boolean;
  contentType: "application/json" | "multipart/form-data";
  howTo: string[];          // numbered instructions
  request: FieldRow[];
  requestExamples: RequestExample[];
  responseExamples: ResponseExample[];
  available: boolean;       // false = "coming soon", greyed in UI
};

// Re-usable condition rows. The same CheckCondition shape ships on every
// slip-verify endpoint, so we declare it once and spread it in.
const CHECK_CONDITION_ROWS: FieldRow[] = [
  {
    key: "payload.checkCondition",
    type: "Object",
    description: "Object เงื่อนไขที่ต้องการตรวจสอบเพิ่มเติม",
    example: "{ ... }",
    required: false,
    note: "ระบุหากต้องการตรวจสอบเงื่อนไขเพิ่มเติม",
  },
  {
    key: "payload.checkCondition.checkDuplicate",
    type: "Boolean",
    description: "ตรวจสลิปซ้ำ — reject ถ้า transRef เคยถูกใช้แล้ว",
    example: "true | false",
    required: false,
  },
  {
    key: "payload.checkCondition.checkReceiver",
    type: "Array",
    description: "Array การตรวจสอบบัญชีผู้รับ",
    example: '[{ accountType, accountNameTH, accountNumber }, ...]',
    required: false,
    note: "ระบุหลายเงื่อนไขได้ — ตรงอย่างน้อย 1 ถือว่าผ่าน",
  },
  {
    key: "payload.checkCondition.checkReceiver.accountType",
    type: "String",
    description: "ธนาคารปลายทาง (ชื่อย่อ เช่น KBANK, SCB, BBL)",
    example: '"KBANK"',
    required: false,
  },
  {
    key: "payload.checkCondition.checkReceiver.accountNameTH",
    type: "String",
    description: "ชื่อบัญชีปลายทาง (ภาษาไทย)",
    example: '"ธันว์ภัสสร สิรทรัพย์ภาคิน"',
    required: false,
    note: "ห้ามใส่คำนำหน้า (นาย/นาง/น.ส.)",
  },
  {
    key: "payload.checkCondition.checkReceiver.accountNameEN",
    type: "String",
    description: "ชื่อบัญชีปลายทาง (ภาษาอังกฤษ)",
    example: '"Thanwapatsorn Sirasupphakin"',
    required: false,
  },
  {
    key: "payload.checkCondition.checkReceiver.accountNumber",
    type: "String",
    description: "เลขที่บัญชี/เบอร์ PromptPay (เทียบ 3-4 หลักท้าย)",
    example: '"xxxxxx4289"',
    required: false,
  },
  {
    key: "payload.checkCondition.checkAmount",
    type: "Object",
    description: "ตรวจจำนวนเงิน",
    example: '{ type: "eq", amount: "55" }',
    required: false,
  },
  {
    key: "payload.checkCondition.checkAmount.type",
    type: "String",
    description: 'รูปแบบเปรียบเทียบ — "eq" | "lte" | "gte" (default "eq")',
    example: '"eq"',
    required: false,
  },
  {
    key: "payload.checkCondition.checkAmount.amount",
    type: "String",
    description: "จำนวนเงิน (บาท ไม่ใช่ satang)",
    example: '"55"',
    required: false,
  },
  {
    key: "payload.checkCondition.checkDate",
    type: "Object",
    description: "ตรวจวันที่โอน",
    example: '{ type: "lte", date: "2026-06-07T23:59:00.000Z" }',
    required: false,
  },
  {
    key: "payload.checkCondition.checkDate.type",
    type: "String",
    description: 'รูปแบบเปรียบเทียบ — "eq" (calendar day) | "lte" | "gte"',
    example: '"eq"',
    required: false,
  },
  {
    key: "payload.checkCondition.checkDate.date",
    type: "DateISO",
    description: "วันที่โอนที่ต้องการเทียบ — ISO-8601 GMT",
    example: '"2026-06-07T08:44:00.000Z"',
    required: false,
  },
  {
    key: "payload.webhook",
    type: "Boolean",
    description: "ยิง customer webhook (slip.verified) เมื่อสำเร็จ",
    example: "true",
    required: false,
  },
];

// Example checkCondition that matches the KBank slip we tested earlier.
const SAMPLE_CHECK_CONDITION = {
  checkDuplicate: true,
  checkReceiver: [
    {
      accountType: "KBANK",
      accountNameTH: "ธันว์ภัสสร สิรทรัพย์ภาคิน",
      accountNumber: "xxxxxx4289",
    },
  ],
  checkAmount: { type: "eq", amount: "55" },
};

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: "slip-base64",
    group: "Slip Verify",
    title: "ตรวจสอบสลิปด้วย Base64",
    shortDescription: "รับรูปภาพ Base64 เพื่อตรวจสอบสลิป",
    method: "POST",
    path: "/api/v1/slip/base64",
    authRequired: true,
    contentType: "application/json",
    available: true,
    howTo: [
      "ระบุ API Secret มาใน Header Authorization ทุกครั้ง — Bearer sk_…",
      "ส่ง image แบบ base64 ผ่านฟิลด์ payload.imageBase64 (รับทั้ง data-URL และ raw base64)",
      "ถ้าต้องการตรวจสอบเงื่อนไขเพิ่มเติม ใส่ในฟิลด์ payload.checkCondition",
    ],
    request: [
      {
        key: "payload",
        type: "Object",
        description: "Object ข้อมูลทั้งหมด",
        example: "{ payload: { ... } }",
        required: true,
      },
      {
        key: "payload.imageBase64",
        type: "Base64",
        description: "รูปสลิปในรูปแบบ Base64 (≤ 8 MB)",
        example: '"data:image/jpeg;base64,/9j/..."',
        required: true,
      },
      ...CHECK_CONDITION_ROWS,
    ],
    requestExamples: [
      {
        label: "Minimal",
        body: { payload: { imageBase64: "data:image/jpeg;base64,/9j/4AAQ..." } },
      },
      {
        label: "With checkCondition",
        body: {
          payload: {
            imageBase64: "data:image/jpeg;base64,/9j/4AAQ...",
            checkCondition: SAMPLE_CHECK_CONDITION,
          },
        },
      },
    ],
    responseExamples: [
      {
        status: 200,
        label: "Success",
        body: {
          ok: true,
          method: "qr",
          verified: true,
          validation: {
            passed: true,
            checks: [
              { check: "duplicate", passed: true },
              { check: "receiver", passed: true, matchedIndex: 0 },
              { check: "amount", passed: true, expected: 5500, actual: 5500, type: "eq" },
            ],
          },
          data: {
            amount_satang: 5500,
            trans_ref: "016158084453BPP09618",
            source_bank: "KBANK",
            target_bank: "PromptPay",
            source_name: "น.ส. ธันว์ภัสสร ส",
            target_name: "ธันว์ภัสสร สิรทรัพย์ภาคิน",
            datetime: "2026-06-07T01:44:00.000Z",
            method: "qr",
            verified: true,
          },
          billing: { charged_satang: 20, used_free: 0, balance_satang: 9980 },
        },
      },
      {
        status: 402,
        label: "Insufficient credit",
        body: {
          ok: false,
          error: "NO_CREDIT",
          message: "Insufficient credit. Top up at /dashboard/topup",
          balance_satang: 0,
        },
      },
      {
        status: 401,
        label: "Unauthorized",
        body: { ok: false, error: "UNAUTHORIZED", message: "Missing or invalid API key" },
      },
    ],
  },
  {
    id: "slip-url",
    group: "Slip Verify",
    title: "ตรวจสอบด้วย Image URL",
    shortDescription: "รับลิงก์รูปภาพ เพื่อตรวจสอบสลิป",
    method: "POST",
    path: "/api/v1/slip/url",
    authRequired: true,
    contentType: "application/json",
    available: true,
    howTo: [
      "ระบุ API Secret มาใน Header Authorization ทุกครั้ง",
      "ส่ง URL ของรูปสลิปผ่านฟิลด์ payload.imageUrl (รองรับ http/https เท่านั้น)",
      "ระบบจะดาวน์โหลดรูปด้วย timeout 10 วินาที และจำกัดขนาด 8 MB",
    ],
    request: [
      {
        key: "payload",
        type: "Object",
        description: "Object ข้อมูลทั้งหมด",
        example: "{ payload: { ... } }",
        required: true,
      },
      {
        key: "payload.imageUrl",
        type: "URL",
        description: "URL ของรูปสลิป (http/https)",
        example: '"https://example.com/slip.jpg"',
        required: true,
      },
      ...CHECK_CONDITION_ROWS,
    ],
    requestExamples: [
      {
        label: "Minimal",
        body: { payload: { imageUrl: "https://example.com/slip.jpg" } },
      },
      {
        label: "With checkCondition",
        body: {
          payload: {
            imageUrl: "https://example.com/slip.jpg",
            checkCondition: SAMPLE_CHECK_CONDITION,
          },
        },
      },
    ],
    responseExamples: [
      {
        status: 502,
        label: "Fetch failed",
        body: { ok: false, error: "FETCH_FAILED", message: "Upstream returned 404" },
      },
      {
        status: 415,
        label: "Not an image",
        body: { ok: false, error: "NOT_IMAGE", message: "content-type=text/html" },
      },
    ],
  },
  {
    id: "slip-multipart",
    group: "Slip Verify",
    title: "ตรวจสอบสลิปด้วยรูปภาพ (Multipart)",
    shortDescription: "อัปโหลดไฟล์ภาพแบบ multipart/form-data",
    method: "POST",
    path: "/api/v1/slip/verify",
    authRequired: true,
    contentType: "multipart/form-data",
    available: true,
    howTo: [
      "ระบุ API Secret มาใน Header Authorization ทุกครั้ง",
      "ส่งไฟล์ภาพในฟิลด์ file (≤ 8 MB)",
      "ใส่ conditions เป็น JSON string ในฟิลด์ conditions (optional)",
    ],
    request: [
      {
        key: "file",
        type: "String",
        description: "ไฟล์ภาพสลิป",
        example: "<image binary>",
        required: true,
      },
      {
        key: "conditions",
        type: "String",
        description: "CheckCondition shape เป็น JSON string",
        example: '\'{"checkAmount":{"amount":"55"}}\'',
        required: false,
      },
      {
        key: "webhook",
        type: "String",
        description: 'ส่ง "1" เพื่อให้ยิง customer webhook',
        example: '"1"',
        required: false,
      },
    ],
    requestExamples: [
      {
        label: "cURL",
        body: {
          // Special-cased in the UI — rendered as a curl command, not JSON.
          __curl:
            "curl -X POST https://remoobbg.com/api/v1/slip/verify \\\n" +
            '  -H "Authorization: Bearer sk_..." \\\n' +
            '  -F "file=@./slip.jpg" \\\n' +
            "  -F 'conditions={\"checkAmount\":{\"amount\":\"55\"}}'",
        },
      },
    ],
    responseExamples: [
      {
        status: 200,
        label: "Success",
        body: {
          ok: true,
          method: "qr",
          verified: true,
          validation: { passed: true, checks: [] },
          data: { amount_satang: 5500, trans_ref: "016158084453BPP09618" },
          billing: { charged_satang: 20, used_free: 0, balance_satang: 9980 },
        },
      },
    ],
  },
  {
    id: "slip-qr-text",
    group: "Slip Verify",
    title: "ตรวจสอบด้วย QR-Code (text)",
    shortDescription: "ส่ง QR text 00020101…6304XXXX เพื่อตรวจสลิป (ไม่ต้องใช้ภาพ)",
    method: "POST",
    path: "/api/v1/slip/qr",
    authRequired: true,
    contentType: "application/json",
    available: true,
    howTo: [
      "ระบุ API Secret มาใน Header Authorization ทุกครั้ง",
      "ส่ง QR text ของสลิป (EMVCo TLV string ที่ขึ้นต้นด้วย 00020101…) ผ่านฟิลด์ payload.qrText",
      "endpoint นี้ไม่ใช้ OCR — เร็วกว่า base64/url แต่จะไม่มีข้อมูล amount/ชื่อจาก visual",
    ],
    request: [
      {
        key: "payload",
        type: "Object",
        description: "Object ข้อมูลทั้งหมด",
        example: "{ payload: { ... } }",
        required: true,
      },
      {
        key: "payload.qrText",
        type: "String",
        description: "ข้อความ EMVCo TLV ที่ decode ออกมาจาก QR",
        example: '"00020101021229...5303764540420.005802TH62...6304XXXX"',
        required: true,
      },
      ...CHECK_CONDITION_ROWS,
    ],
    requestExamples: [
      {
        label: "Minimal",
        body: {
          payload: { qrText: "00020101021229370016A0000006770101110113006601234567890123456789530376463047A92" },
        },
      },
    ],
    responseExamples: [
      {
        status: 200,
        label: "Success",
        body: {
          ok: true,
          method: "qr",
          verified: false,
          validation: { passed: true, checks: [] },
          data: {
            trans_ref: "16158084453BPP09618",
            amount_satang: null,
            source_bank: "KBANK",
            method: "qr",
            verified: false,
          },
          billing: { charged_satang: 20, used_free: 0, balance_satang: 9980 },
        },
      },
      {
        status: 422,
        label: "Bad QR text",
        body: { ok: false, error: "BAD_QR", message: "QR text could not be parsed as a slip-verify payload" },
      },
    ],
  },
  {
    id: "slip-retrieve",
    group: "Slip Verify",
    title: "ดึงข้อมูลสลิปเก่า",
    shortDescription: "ขอข้อมูลสลิปที่เคยตรวจสอบแล้ว ด้วย transRef",
    method: "GET",
    path: "/api/v1/slip/{transRef}",
    authRequired: true,
    contentType: "application/json",
    available: true,
    howTo: [
      "ระบุ API Secret มาใน Header Authorization ทุกครั้ง",
      "ใส่ transRef ของสลิปที่เคยตรวจไว้แล้วใน URL path",
      "ผลลัพธ์จะ scope ตาม userId ของ key — เห็นเฉพาะสลิปของตัวเอง",
      "endpoint นี้ไม่คิดเครดิต — เป็น read-only",
    ],
    request: [
      {
        key: "transRef",
        type: "String",
        description: "Path parameter — เลข trans reference (URL-encoded ถ้ามีอักขระพิเศษ)",
        example: '"016158084453BPP09618"',
        required: true,
      },
    ],
    requestExamples: [
      {
        label: "cURL",
        body: {
          __curl:
            "curl https://remoobbg.com/api/v1/slip/016158084453BPP09618 \\\n" +
            '  -H "Authorization: Bearer sk_..."',
        },
      },
    ],
    responseExamples: [
      {
        status: 200,
        label: "Success",
        body: {
          ok: true,
          data: {
            id: "slp_xxx",
            trans_ref: "016158084453BPP09618",
            method: "qr",
            verified: true,
            amount_satang: 5500,
            source_bank: "KBANK",
            target_bank: "PromptPay",
            source_name: "น.ส. ธันว์ภัสสร ส",
            target_name: "ธันว์ภัสสร สิรทรัพย์ภาคิน",
            datetime: "2026-06-07T01:44:00.000Z",
            created_at: "2026-06-07T01:45:23.000Z",
          },
        },
      },
      {
        status: 404,
        label: "Not found",
        body: { ok: false, error: "NOT_FOUND", message: "No slip found for transRef …" },
      },
    ],
  },
  {
    id: "account-info",
    group: "Account",
    title: "ดึงข้อมูลบัญชี",
    shortDescription: "ขอข้อมูลบัญชี เช่น เครดิตคงเหลือ + quota เดือนนี้",
    method: "GET",
    path: "/api/v1/account",
    authRequired: true,
    contentType: "application/json",
    available: true,
    howTo: [
      "ระบุ API Secret มาใน Header Authorization",
      "ใช้สำหรับเช็คว่า key ใช้ได้หรือยัง + ดูยอดเครดิตคงเหลือ + จำนวนสลิปฟรีที่เหลือเดือนนี้",
      "endpoint นี้ไม่คิดเครดิต",
    ],
    request: [],
    requestExamples: [
      {
        label: "cURL",
        body: {
          __curl:
            "curl https://remoobbg.com/api/v1/account \\\n" +
            '  -H "Authorization: Bearer sk_..."',
        },
      },
    ],
    responseExamples: [
      {
        status: 200,
        label: "Success",
        body: {
          ok: true,
          free_remaining: 87,
          free_resets_at: "2026-07-01T00:00:00.000Z",
          balance_satang: 9980,
          balance_baht: 99.8,
          price_per_slip_satang: 20,
          sandbox: false,
        },
      },
    ],
  },
];

export function findEndpoint(id: string): EndpointDoc | undefined {
  return ENDPOINTS.find((e) => e.id === id);
}
