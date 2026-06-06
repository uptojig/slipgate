import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/landing/header";
import { CodeTabs, type CodeTab } from "@/components/docs/code-tabs";

export const metadata: Metadata = {
  title: "เอกสาร API – SlipGate",
  description:
    "เอกสารการใช้งาน SlipGate API: ตรวจสอบสลิป, bulk verify, ตรวจยอดเครดิต และ Webhook สำหรับนักพัฒนา",
};

const DOCS_NAV = [
  { href: "/#features", label: "ฟีเจอร์" },
  { href: "/#pricing", label: "ราคา" },
  { href: "/docs", label: "เอกสาร API" },
];

type TocItem = {
  id: string;
  label: string;
};

const TOC: TocItem[] = [
  { id: "getting-started", label: "เริ่มต้นใช้งาน" },
  { id: "auth", label: "Authentication" },
  { id: "pricing", label: "Rate Limits & Pricing" },
  { id: "base-url", label: "Base URL" },
  { id: "slip-verify", label: "POST /v1/slip/verify" },
  { id: "slip-bulk", label: "POST /v1/slip/bulk" },
  { id: "account", label: "GET /v1/account" },
  { id: "webhooks", label: "Customer Webhooks" },
  { id: "sandbox", label: "Sandbox" },
  { id: "errors", label: "Errors" },
];

const BASE_URL = "https://api.slipgate.io/v1";

// ---------- code samples ----------

const SLIP_VERIFY_TABS: CodeTab[] = [
  {
    label: "cURL",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/slip/verify \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -F "file=@slip.jpg" \\
  -F "webhook=1"`,
  },
  {
    label: "Node.js",
    lang: "javascript",
    code: `import { readFile } from "node:fs/promises";

const buf = await readFile("./slip.jpg");
const form = new FormData();
form.append("file", new Blob([buf], { type: "image/jpeg" }), "slip.jpg");
form.append("webhook", "1");

const res = await fetch("${BASE_URL}/slip/verify", {
  method: "POST",
  headers: { Authorization: "Bearer sk_live_xxx" },
  body: form,
});

const data = await res.json();
console.log(data);`,
  },
  {
    label: "PHP",
    lang: "php",
    code: `<?php
$ch = curl_init("${BASE_URL}/slip/verify");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_live_xxx",
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, [
    "file"    => new CURLFile("/path/to/slip.jpg", "image/jpeg", "slip.jpg"),
    "webhook" => "1",
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($response, true);
print_r($data);`,
  },
];

const SLIP_VERIFY_RESPONSE = `{
  "ok": true,
  "data": {
    "trans_ref": "01420059142554XPTKZ4UB91A2",
    "amount": 250.00,
    "currency": "THB",
    "sender": {
      "name": "นาย ธนากร ใจดี",
      "bank": "KBANK",
      "account_last4": "1234"
    },
    "receiver": {
      "name": "บริษัท สลิปเกต จำกัด",
      "bank": "SCB",
      "account_last4": "5678"
    },
    "transferred_at": "2026-06-06T10:32:00+07:00",
    "verified_via": "qr",
    "duplicate": false
  },
  "credit": {
    "charged": 0.20,
    "remaining": 99.80,
    "free_quota_used": 0
  }
}`;

const SLIP_BULK_TABS: CodeTab[] = [
  {
    label: "cURL",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/slip/bulk \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -F "file=@slip-1.jpg" \\
  -F "file=@slip-2.jpg" \\
  -F "file=@slip-3.jpg"`,
  },
  {
    label: "Node.js",
    lang: "javascript",
    code: `import { readFile } from "node:fs/promises";

const files = ["slip-1.jpg", "slip-2.jpg", "slip-3.jpg"];
const form = new FormData();

for (const path of files) {
  const buf = await readFile(path);
  form.append("file", new Blob([buf], { type: "image/jpeg" }), path);
}

const res = await fetch("${BASE_URL}/slip/bulk", {
  method: "POST",
  headers: { Authorization: "Bearer sk_live_xxx" },
  body: form,
});

const { ok, results, credit } = await res.json();
console.log(results.length, "rows; remaining", credit.remaining);`,
  },
  {
    label: "PHP",
    lang: "php",
    code: `<?php
$files = ["slip-1.jpg", "slip-2.jpg", "slip-3.jpg"];
$post  = [];
foreach ($files as $i => $path) {
    $post["file[$i]"] = new CURLFile($path, "image/jpeg", basename($path));
}

$ch = curl_init("${BASE_URL}/slip/bulk");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_live_xxx",
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $post);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
foreach ($data["results"] as $row) {
    echo $row["ok"] ? $row["data"]["trans_ref"] : $row["error"]["code"];
    echo "\\n";
}`,
  },
];

const SLIP_BULK_RESPONSE = `{
  "ok": true,
  "results": [
    {
      "index": 0,
      "ok": true,
      "data": { "trans_ref": "0142...A2", "amount": 250.00 }
    },
    {
      "index": 1,
      "ok": false,
      "error": { "code": "DUPLICATE", "message": "Slip already verified" }
    },
    {
      "index": 2,
      "ok": true,
      "data": { "trans_ref": "0142...B7", "amount": 120.00 }
    }
  ],
  "credit": {
    "charged": 0.40,
    "remaining": 99.40,
    "free_quota_used": 0
  }
}`;

const ACCOUNT_TABS: CodeTab[] = [
  {
    label: "cURL",
    lang: "bash",
    code: `curl ${BASE_URL}/account \\
  -H "Authorization: Bearer sk_live_xxx"`,
  },
  {
    label: "Node.js",
    lang: "javascript",
    code: `const res = await fetch("${BASE_URL}/account", {
  headers: { Authorization: "Bearer sk_live_xxx" },
});
const { balance, free_quota } = await res.json();
console.log("balance:", balance, "free remaining:", free_quota.remaining);`,
  },
  {
    label: "PHP",
    lang: "php",
    code: `<?php
$ch = curl_init("${BASE_URL}/account");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_live_xxx",
]);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
echo "balance: " . $data["balance"] . "\\n";`,
  },
];

const ACCOUNT_RESPONSE = `{
  "ok": true,
  "account_id": "acc_01HZQK8W6V",
  "balance": 142.60,
  "currency": "THB",
  "free_quota": {
    "limit": 100,
    "used": 23,
    "remaining": 77,
    "resets_at": "2026-07-01T00:00:00+07:00"
  },
  "plan": "free",
  "mode": "live"
}`;

const WEBHOOK_REGISTER_TABS: CodeTab[] = [
  {
    label: "cURL",
    lang: "bash",
    code: `curl -X POST ${BASE_URL}/webhooks \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yourapp.com/webhooks/slipgate",
    "events": ["slip.verified", "slip.duplicate"]
  }'`,
  },
];

const WEBHOOK_PAYLOAD = `{
  "id": "evt_01HZQM5R7K",
  "type": "slip.verified",
  "created_at": "2026-06-06T10:33:01+07:00",
  "data": {
    "trans_ref": "01420059142554XPTKZ4UB91A2",
    "amount": 250.00,
    "sender_name": "นาย ธนากร ใจดี"
  }
}`;

const WEBHOOK_VERIFY_TABS: CodeTab[] = [
  {
    label: "Node.js",
    lang: "javascript",
    code: `import crypto from "node:crypto";
import express from "express";

const app = express();
const SECRET = process.env.SLIPGATE_WEBHOOK_SECRET;

app.post(
  "/webhooks/slipgate",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const header = req.header("X-SlipGate-Signature") ?? "";
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");

    const ok =
      header.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));

    if (!ok) return res.status(401).send("invalid signature");

    const event = JSON.parse(req.body.toString("utf8"));
    // handle event.type === "slip.verified", etc.
    res.json({ received: true });
  }
);`,
  },
  {
    label: "PHP",
    lang: "php",
    code: `<?php
$secret  = getenv("SLIPGATE_WEBHOOK_SECRET");
$body    = file_get_contents("php://input");
$header  = $_SERVER["HTTP_X_SLIPGATE_SIGNATURE"] ?? "";
$expect  = "sha256=" . hash_hmac("sha256", $body, $secret);

if (!hash_equals($expect, $header)) {
    http_response_code(401);
    echo "invalid signature";
    exit;
}

$event = json_decode($body, true);
// handle $event["type"] === "slip.verified", etc.
http_response_code(200);
echo json_encode(["received" => true]);`,
  },
];

// ---------- helpers ----------

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl md:text-3xl font-bold tracking-tight mt-12 first:mt-0">
      <a href={`#${id}`} className="hover:text-brand-600">
        {children}
      </a>
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold mt-6 mb-2 text-zinc-900">{children}</h3>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 text-zinc-800 px-1.5 py-0.5 text-[0.85em] font-mono border border-zinc-200">
      {children}
    </code>
  );
}

function Pre({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre
      className="bg-zinc-900 text-zinc-100 rounded-md p-4 text-xs overflow-x-auto leading-relaxed"
      data-lang={lang}
    >
      <code data-lang={lang}>{children}</code>
    </pre>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const styles =
    method === "GET"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-brand-50 text-brand-700 border-brand-200";
  return (
    <span
      className={
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold font-mono " +
        styles
      }
    >
      {method}
    </span>
  );
}

function EndpointHeader({
  method,
  path,
}: {
  method: "GET" | "POST";
  path: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm">
      <MethodBadge method={method} />
      <span className="text-zinc-900">{path}</span>
    </div>
  );
}

// ---------- error tables ----------

type ErrorRow = {
  status: number;
  code: string;
  desc: string;
};

const SLIP_VERIFY_ERRORS: ErrorRow[] = [
  { status: 401, code: "UNAUTHORIZED", desc: "ไม่พบหรือใช้ API key ผิด" },
  { status: 402, code: "NO_CREDIT", desc: "เครดิตหมดและใช้โควต้าฟรีครบแล้ว" },
  { status: 413, code: "FILE_TOO_LARGE", desc: "ไฟล์เกิน 5 MB" },
  { status: 422, code: "INVALID_SLIP", desc: "ไม่สามารถอ่านข้อมูลจากสลิปได้" },
];

const ALL_ERRORS: ErrorRow[] = [
  { status: 400, code: "BAD_REQUEST", desc: "พารามิเตอร์ไม่ถูกต้องหรือขาดฟิลด์ที่จำเป็น" },
  { status: 401, code: "UNAUTHORIZED", desc: "ไม่พบ Authorization header หรือ API key ไม่ถูกต้อง" },
  { status: 402, code: "NO_CREDIT", desc: "เครดิตไม่พอและใช้โควต้าฟรีหมดแล้ว เติมเครดิตที่ /dashboard/billing" },
  { status: 403, code: "FORBIDDEN", desc: "API key นี้ไม่มีสิทธิ์เรียก endpoint ดังกล่าว" },
  { status: 404, code: "NOT_FOUND", desc: "ไม่พบ resource ที่อ้างถึง" },
  { status: 409, code: "DUPLICATE", desc: "สลิปนี้เคยถูก verify ไปแล้ว" },
  { status: 413, code: "FILE_TOO_LARGE", desc: "ไฟล์เกิน 5 MB (verify) หรือเกิน 50 ไฟล์ (bulk)" },
  { status: 415, code: "UNSUPPORTED_MEDIA", desc: "รองรับเฉพาะ image/jpeg, image/png, image/webp" },
  { status: 422, code: "INVALID_SLIP", desc: "อ่าน QR หรือ OCR สลิปไม่สำเร็จ" },
  { status: 429, code: "RATE_LIMITED", desc: "เรียกถี่เกินขีดจำกัด (60 req/นาที สำหรับแผน Free)" },
  { status: 500, code: "INTERNAL_ERROR", desc: "เกิดข้อผิดพลาดที่ฝั่งระบบ ลองใหม่อีกครั้งหรือติดต่อทีมงาน" },
  { status: 503, code: "UPSTREAM_DOWN", desc: "ระบบ verify ฝั่งธนาคารไม่ตอบสนองชั่วคราว" },
];

function ErrorTable({ rows }: { rows: ErrorRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2 font-medium">HTTP</th>
            <th className="px-4 py-2 font-medium">Code</th>
            <th className="px-4 py-2 font-medium">คำอธิบาย</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.code} className="bg-white">
              <td className="px-4 py-2 font-mono text-zinc-900">{r.status}</td>
              <td className="px-4 py-2 font-mono text-brand-700">{r.code}</td>
              <td className="px-4 py-2 text-zinc-700">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- page ----------

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <Header nav={DOCS_NAV} />

      <div className="container-page py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-10">
          <aside className="md:sticky md:top-20 md:self-start">
            <nav aria-label="สารบัญ" className="text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                สารบัญ
              </p>
              <ol className="space-y-1.5">
                {TOC.map((item, idx) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="flex items-baseline gap-2 text-zinc-600 hover:text-brand-600"
                    >
                      <span className="text-xs tabular-nums text-zinc-400">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0 max-w-3xl text-[15px] leading-relaxed text-zinc-700">
            <header className="mb-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                SlipGate API
              </p>
              <h1 className="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900">
                เอกสาร API
              </h1>
              <p className="mt-4 text-zinc-600">
                ระบบตรวจสอบสลิปสำหรับนักพัฒนา เริ่มใช้งานได้ภายใน 5 นาที
                รองรับการตรวจ QR สลิปทุกธนาคารและ TrueMoney พร้อม Webhook ส่งกลับเข้าสู่แอปของคุณ
              </p>
            </header>

            {/* 1. Getting Started */}
            <section>
              <SectionHeading id="getting-started">1. เริ่มต้นใช้งาน</SectionHeading>
              <p className="mt-4">
                ใช้งาน SlipGate API ได้ใน 3 ขั้นตอน:
              </p>
              <ol className="mt-3 list-decimal list-inside space-y-2 marker:text-brand-600 marker:font-semibold">
                <li>
                  <Link href="/register" className="text-brand-700 hover:underline">
                    สมัครบัญชีฟรี
                  </Link>{" "}
                  ที่ SlipGate (ไม่ต้องผูกบัตรเครดิต)
                </li>
                <li>
                  สร้าง API key ที่หน้า{" "}
                  <Link href="/dashboard/api-keys" className="text-brand-700 hover:underline">
                    /dashboard/api-keys
                  </Link>{" "}
                  จะได้ key ขึ้นต้นด้วย <Code>sk_live_</Code> หรือ <Code>sk_test_</Code>
                </li>
                <li>
                  เรียก API โดยส่ง header <Code>Authorization: Bearer &lt;API_KEY&gt;</Code>{" "}
                  ในทุก request
                </li>
              </ol>
              <p className="mt-4">
                ตัวอย่างการเรียก endpoint ตรวจสอบยอดเครดิตเพื่อทดสอบ key:
              </p>
              <div className="mt-3">
                <Pre lang="bash">{`curl ${BASE_URL}/account \\
  -H "Authorization: Bearer sk_live_xxx"`}</Pre>
              </div>
            </section>

            {/* 2. Authentication */}
            <section>
              <SectionHeading id="auth">2. Authentication</SectionHeading>
              <p className="mt-4">
                ทุก request ต้องส่ง HTTP header <Code>Authorization</Code> แบบ Bearer token
                ตัว API key เป็นตัวระบุทั้งบัญชีและโหมดการใช้งาน:
              </p>
              <div className="mt-4">
                <Pre lang="http">{`Authorization: Bearer sk_live_8c2f9b1d4a7e6f5c0b3a2d9e8f7c6b5a
# หรือสำหรับ sandbox / แผน Free ที่ต้องการทดลอง
Authorization: Bearer sk_test_d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8`}</Pre>
              </div>
              <ul className="mt-4 list-disc list-inside space-y-1.5">
                <li>
                  <Code>sk_live_*</Code> – production keys ใช้ตรวจสลิปจริง หักเงินจากเครดิตหรือใช้โควต้าฟรี
                </li>
                <li>
                  <Code>sk_test_*</Code> – sandbox keys คืนข้อมูลสลิป mock data, ไม่หักเครดิต
                </li>
                <li>เก็บ API key ฝั่ง server เท่านั้น อย่าฝังลงโค้ดฝั่ง browser หรือแอปมือถือ</li>
                <li>
                  หาก key หลุดให้กดปุ่ม revoke ที่หน้า{" "}
                  <Link href="/dashboard/api-keys" className="text-brand-700 hover:underline">
                    /dashboard/api-keys
                  </Link>{" "}
                  ระบบจะ invalidate ทันที
                </li>
              </ul>
            </section>

            {/* 3. Pricing */}
            <section>
              <SectionHeading id="pricing">3. Rate Limits & Pricing</SectionHeading>
              <p className="mt-4">
                ราคา <strong>฿0.20 ต่อสลิป</strong> หักจากเครดิตในบัญชี
                ผู้ใช้ทุกคนได้โควต้าฟรี <strong>100 สลิป/เดือน</strong>{" "}
                ก่อนเริ่มหักเงินจริง โควต้าฟรี reset ทุกวันที่ 1 ของเดือน
              </p>

              <div className="mt-5 overflow-x-auto rounded-md border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">โหมด</th>
                      <th className="px-4 py-2 font-medium">ค่าใช้จ่าย</th>
                      <th className="px-4 py-2 font-medium">Rate limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr className="bg-white">
                      <td className="px-4 py-2 font-mono">sk_live_*</td>
                      <td className="px-4 py-2">฿0.20/สลิป (หลังใช้โควต้าฟรีหมด)</td>
                      <td className="px-4 py-2">60 req/นาที</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-4 py-2 font-mono">sk_test_*</td>
                      <td className="px-4 py-2">ไม่หักเงิน, ไม่ใช้โควต้า</td>
                      <td className="px-4 py-2">120 req/นาที</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-4">
                เมื่อเครดิตและโควต้าฟรีหมด ระบบจะตอบ HTTP <Code>402 NO_CREDIT</Code>{" "}
                ให้เติมเครดิตที่หน้า{" "}
                <Link href="/dashboard/billing" className="text-brand-700 hover:underline">
                  /dashboard/billing
                </Link>
              </p>
            </section>

            {/* 4. Base URL */}
            <section>
              <SectionHeading id="base-url">4. Base URL</SectionHeading>
              <p className="mt-4">ทุก endpoint ในเอกสารนี้อยู่ภายใต้ base URL เดียวกัน:</p>
              <div className="mt-3">
                <Pre lang="text">{BASE_URL}</Pre>
              </div>
              <p className="mt-4">
                ทั้งโหมด production และ sandbox ใช้ host เดียวกัน
                ระบบแยกโหมดจาก prefix ของ API key (<Code>sk_live_</Code> หรือ <Code>sk_test_</Code>)
              </p>
            </section>

            {/* 5. POST /v1/slip/verify */}
            <section>
              <SectionHeading id="slip-verify">5. POST /v1/slip/verify</SectionHeading>
              <p className="mt-4">
                ส่งภาพสลิปเข้ามาตรวจสอบทีละใบ ระบบจะลอง decode QR EMVCo บนสลิปก่อน
                หาก QR เสียจะ fallback ไป OCR อ่านยอดและผู้โอนแทน
              </p>
              <EndpointHeader method="POST" path="/v1/slip/verify" />

              <SubHeading>Request</SubHeading>
              <p>
                ส่งเป็น <Code>multipart/form-data</Code> โดยมีฟิลด์ดังนี้:
              </p>
              <ul className="mt-3 list-disc list-inside space-y-1.5">
                <li>
                  <Code>file</Code> (required) – ภาพสลิป JPEG/PNG/WebP ขนาดไม่เกิน 5 MB
                </li>
                <li>
                  <Code>webhook</Code> (optional) – ส่ง <Code>1</Code>{" "}
                  เพื่อให้ระบบยิง event <Code>slip.verified</Code> เข้า webhook
                  ที่ลงทะเบียนไว้ด้วย
                </li>
              </ul>

              <SubHeading>ตัวอย่างโค้ด</SubHeading>
              <CodeTabs tabs={SLIP_VERIFY_TABS} ariaLabel="ตัวอย่างเรียก POST /v1/slip/verify" />

              <SubHeading>Response (200 OK)</SubHeading>
              <Pre lang="json">{SLIP_VERIFY_RESPONSE}</Pre>

              <SubHeading>Error codes</SubHeading>
              <ErrorTable rows={SLIP_VERIFY_ERRORS} />
            </section>

            {/* 6. POST /v1/slip/bulk */}
            <section>
              <SectionHeading id="slip-bulk">6. POST /v1/slip/bulk</SectionHeading>
              <p className="mt-4">
                ส่งหลายสลิปพร้อมกัน (สูงสุด <strong>50 ไฟล์ต่อ request</strong>){" "}
                ระบบ pre-check เครดิตก่อน—หากเครดิต+โควต้าฟรีไม่พอจ่ายทั้งชุด
                จะตอบ <Code>402 NO_CREDIT</Code> โดยไม่ประมวลผลใด ๆ
                แต่ละไฟล์มีผลลัพธ์ของตัวเองใน array <Code>results</Code>{" "}
                แม้บางใบจะ verify ไม่ผ่านก็ไม่กระทบใบอื่น
              </p>
              <EndpointHeader method="POST" path="/v1/slip/bulk" />

              <SubHeading>Request</SubHeading>
              <p>
                ส่งเป็น <Code>multipart/form-data</Code> โดยใส่ฟิลด์ <Code>file</Code>{" "}
                ได้หลายครั้ง (สูงสุด 50 ครั้ง) แต่ละไฟล์ขนาดไม่เกิน 5 MB
              </p>

              <SubHeading>ตัวอย่างโค้ด</SubHeading>
              <CodeTabs tabs={SLIP_BULK_TABS} ariaLabel="ตัวอย่างเรียก POST /v1/slip/bulk" />

              <SubHeading>Response (200 OK)</SubHeading>
              <Pre lang="json">{SLIP_BULK_RESPONSE}</Pre>

              <p className="mt-4 text-sm text-zinc-600">
                ฟิลด์ <Code>credit.charged</Code> เป็นผลรวมของไฟล์ที่ verify สำเร็จเท่านั้น{" "}
                ไฟล์ที่ตอบ <Code>ok: false</Code> จะไม่ถูกหักเครดิต
              </p>
            </section>

            {/* 7. GET /v1/account */}
            <section>
              <SectionHeading id="account">7. GET /v1/account</SectionHeading>
              <p className="mt-4">
                ดูยอดเครดิตคงเหลือและสถานะโควต้าฟรีของบัญชี
                ใช้สำหรับแสดงผลในแดชบอร์ดของเว็บคุณหรือไว้ alert เมื่อใกล้หมด
              </p>
              <EndpointHeader method="GET" path="/v1/account" />

              <SubHeading>ตัวอย่างโค้ด</SubHeading>
              <CodeTabs tabs={ACCOUNT_TABS} ariaLabel="ตัวอย่างเรียก GET /v1/account" />

              <SubHeading>Response (200 OK)</SubHeading>
              <Pre lang="json">{ACCOUNT_RESPONSE}</Pre>
            </section>

            {/* 8. Webhooks */}
            <section>
              <SectionHeading id="webhooks">8. Customer Webhooks</SectionHeading>
              <p className="mt-4">
                ลงทะเบียน URL ของระบบคุณเพื่อรับ event แบบ real-time
                เมื่อสลิปถูก verify สำเร็จหรือมีเหตุการณ์ที่ต้องการแจ้งกลับ
                ทุก request จาก SlipGate จะเซ็นด้วย HMAC-SHA256
                คุณจึงตรวจสอบได้แน่ใจว่ามาจาก SlipGate จริง
              </p>

              <SubHeading>ลงทะเบียน webhook</SubHeading>
              <EndpointHeader method="POST" path="/v1/webhooks" />
              <div className="mt-3">
                <CodeTabs tabs={WEBHOOK_REGISTER_TABS} ariaLabel="ตัวอย่างลงทะเบียน webhook" />
              </div>
              <p className="mt-4 text-sm text-zinc-600">
                หลังลงทะเบียนสำเร็จระบบจะคืนค่า <Code>secret</Code> ใช้สำหรับ verify signature
                เก็บค่านี้ไว้เป็นความลับและตั้งใน env ของเว็บคุณ (เช่น{" "}
                <Code>SLIPGATE_WEBHOOK_SECRET</Code>)
              </p>

              <SubHeading>โครงสร้าง payload</SubHeading>
              <p>
                Event ถูกส่งเป็น HTTP POST body แบบ JSON พร้อม header{" "}
                <Code>X-SlipGate-Signature: sha256=&lt;hex&gt;</Code> โดยค่า <Code>hex</Code>{" "}
                คือ HMAC-SHA256 ของ raw body ใช้ <Code>secret</Code> ที่ระบบให้ตอนลงทะเบียน
              </p>
              <div className="mt-3">
                <Pre lang="json">{WEBHOOK_PAYLOAD}</Pre>
              </div>

              <SubHeading>ตรวจสอบ signature</SubHeading>
              <p>
                เปรียบเทียบค่าใน header กับ HMAC ที่คำนวณจาก body
                โดยใช้ฟังก์ชัน timing-safe comparison เพื่อกัน timing attack:
              </p>
              <div className="mt-3">
                <CodeTabs tabs={WEBHOOK_VERIFY_TABS} ariaLabel="ตัวอย่าง verify signature" />
              </div>

              <p className="mt-4 text-sm text-zinc-600">
                หาก endpoint ของคุณตอบกลับเป็น status code อื่นที่ไม่ใช่ <Code>2xx</Code>{" "}
                ระบบจะ retry ด้วย exponential backoff สูงสุด 5 ครั้งในช่วง 24 ชั่วโมง
              </p>
            </section>

            {/* 9. Sandbox */}
            <section>
              <SectionHeading id="sandbox">9. Sandbox</SectionHeading>
              <p className="mt-4">
                ใช้ API key ที่ขึ้นต้นด้วย <Code>sk_test_</Code>{" "}
                เพื่อทดสอบการเชื่อมต่อโดยไม่เปลือง quota และไม่หักเงิน
                ระบบจะคืน mock data ที่มีโครงสร้างเหมือน production ทุกประการ
                เหมาะสำหรับใช้ใน CI/CD หรือ local development
              </p>
              <ul className="mt-4 list-disc list-inside space-y-1.5">
                <li>คืนผลลัพธ์ deterministic — ภาพเดิมให้ผลเดิมเสมอ</li>
                <li>
                  เพิ่ม <Code>?force_error=NO_CREDIT</Code> ที่ท้าย URL
                  เพื่อจำลอง error response ทุกชนิดที่ตารางในหัวข้อ Errors ระบุไว้
                </li>
                <li>
                  Webhook ใน sandbox ส่งจริง ระบบจะยิงไป URL ที่ลงทะเบียนเหมือนกับ production
                  แต่ข้อมูลใน payload เป็น mock
                </li>
                <li>
                  Response เพิ่ม field <Code>{`"mode": "test"`}</Code> ให้ระบบของคุณแยกได้
                </li>
              </ul>
            </section>

            {/* 10. Errors */}
            <section>
              <SectionHeading id="errors">10. Errors</SectionHeading>
              <p className="mt-4">
                ทุก error response มีโครงสร้างเดียวกัน:
              </p>
              <div className="mt-3">
                <Pre lang="json">{`{
  "ok": false,
  "error": {
    "code": "NO_CREDIT",
    "message": "Insufficient credit. Top up at /dashboard/billing",
    "request_id": "req_01HZQK8W6V"
  }
}`}</Pre>
              </div>
              <p className="mt-4">
                ส่งค่า <Code>request_id</Code> มาด้วยเมื่อแจ้งทีมงานเพื่อให้ตรวจสอบ log ได้เร็วขึ้น
              </p>

              <SubHeading>ตารางสรุป error codes</SubHeading>
              <ErrorTable rows={ALL_ERRORS} />
            </section>

            <footer className="mt-16 border-t border-zinc-200 pt-6 text-sm text-zinc-500">
              <p>
                มีคำถาม? ติดต่อทีม support ที่{" "}
                <a href="mailto:dev@slipgate.io" className="text-brand-700 hover:underline">
                  dev@slipgate.io
                </a>{" "}
                หรือดู{" "}
                <Link href="/dashboard" className="text-brand-700 hover:underline">
                  Dashboard
                </Link>{" "}
                สำหรับ usage และ logs ของบัญชีคุณ
              </p>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
