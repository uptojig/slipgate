# SlipGate

ระบบตรวจสอบสลิปและเติมเครดิตอัตโนมัติ สำหรับร้านค้าออนไลน์ในไทย — รองรับ
TrueMoney Wallet (Official Webhook), สลิปทุกธนาคารไทย และซองอั่งเปา (อั่งเปาทรู)

## ฟีเจอร์

- 🔔 **TrueMoney Official Webhook (11 event types)** — รับ event ครบทั้งเงินเข้า + เงินออก + ค่าธรรมเนียม
  ผ่าน JWT HS256 verification — `P2P`, `MONEY_LINK`, `DIRECT_TOPUP`, `PROMPTPAY_IN`,
  `BANK_WITHDRAW`, `SEND_P2P`, `SEND_MONEY_LINK`, `SEND_MONEY_PLUS`,
  `PROMPTPAY_TAG29/30`, `FEE_PAYMENT`
- 🔁 **Auto-match Withdrawal** — เมื่อ admin โอนเงินถอนผ่านแอป TMN → webhook ยิง
  `BANK_WITHDRAW` กลับ → ระบบ match กับ withdrawal request ที่ pending อยู่ทันที
  (ใช้ amount + dest_account ใน 7 วัน) แล้ว mark `status: paid`
- 📷 **Slip QR + OCR** — อ่าน QR EMVCo TLV บนสลิปทุกธนาคารไทย + fallback OCR
  ผ่าน Vercel AI Gateway (Claude/GPT vision)
- 🎁 **ซองอั่งเปา TrueMoney** — รับซองผ่าน public endpoint ของ TrueMoney
  พร้อมตรวจซ้ำ + เติมเครดิตอัตโนมัติ
- 💰 **Credit Ledger** — ทุกรายการเงินถูกบันทึกแบบ double-entry, idempotent
  ป้องกัน double-credit แม้ webhook ส่งซ้ำ
- 🔑 **API Keys + Dashboard** — ออก API key สำหรับเว็บคุณ + dashboard ดูรายการ
  / ยอดเงิน / ขอถอน

## เทคโนโลยี

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS + Radix UI primitives |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Session cookies + bcrypt (in-house) |
| OCR | Vercel AI Gateway (any vision model) |
| Container | Docker + EasyPanel |

## โครงสร้าง

```
src/
├── app/
│   ├── page.tsx               หน้าแรก (Landing)
│   ├── (auth)/                Login / Register
│   ├── dashboard/             หน้าสำหรับผู้ใช้
│   └── api/
│       ├── webhook/truemoney  รับ webhook ทรูมันนี่ (?u=<userId>) — push
│       ├── tmn/sync           ดึงรายการรับเงินล่าสุด (account/v1/my-last-receive) — pull
│       ├── slip/verify        ตรวจสลิปจากไฟล์ภาพ (QR + OCR + TMN validate)
│       ├── slip/tmn-validate  เช็ค TrueMoney P2P slip ตรงด้วย trans_ref
│       ├── voucher/redeem     รับซองอั่งเปา
│       ├── voucher/info       parse ลิงก์อั่งเปา (ไม่ redeem)
│       ├── balance            ดูยอดเครดิต (Bearer API key)
│       ├── transactions       ลิสต์รายการ (Bearer API key)
│       └── withdraw           ขอถอน (Bearer API key)
├── lib/
│   ├── auth.ts                session + bcrypt
│   ├── api-auth.ts            Bearer key → userId
│   ├── credit/ledger.ts       atomic credit/debit + idempotency
│   ├── truemoney/
│   │   ├── client.ts          shared envelope (status/data/err) + HTTP error map
│   │   ├── webhook.ts         JWT verify (HS256) — push channel, baht float
│   │   ├── account.ts         apis.truemoneyservices.com/account/v1/* — pull channel, satang int
│   │   ├── p2p-validate.ts    apis.truemoneyservices.com/validate/v1/p2p
│   │   └── voucher.ts         gift.truemoney.com redeemer
│   └── slip/
│       ├── qr.ts              jsQR + sharp preprocessing
│       ├── parser.ts          EMVCo TLV → structured slip data
│       └── ocr.ts             vision model fallback
└── db/
    ├── schema.ts              Drizzle schema
    └── migrations/            generated SQL
```

## เริ่มต้นใช้งาน (local)

### 1. ติดตั้ง deps

```bash
npm install
cp .env.example .env
# แก้ค่าใน .env ให้เรียบร้อย
```

### 2. รัน Postgres + รัน migration

```bash
docker-compose up -d postgres
npm run db:push
```

### 3. รัน dev server

```bash
npm run dev
# เปิด http://localhost:3000
```

### 4. สมัครสมาชิก + ตั้งค่า TrueMoney Webhook

1. สมัครที่ `/register`
2. ที่หน้า Dashboard จะแสดง webhook URL เฉพาะของคุณ เช่น
   `https://yourdomain.com/api/webhook/truemoney?u=usr_xxxxxxxx`
3. เปิดแอป TrueMoney Wallet → **ทรูมันนี่** → **ตั้งค่า API**
4. วาง URL ลงในช่อง **Endpoint URL**
5. คัดลอก **Authorization key** (เช่น `SDGKDF3435`) มาใส่ใน
   env `TMN_WEBHOOK_AUTH_KEY`
6. คัดลอก **JWT Secret** (alg HS256) จากแอป มาใส่ใน
   env `TMN_WEBHOOK_JWT_SECRET`
7. เปิดทั้ง toggle "รับเงิน" และ "เติมเงิน" ในแอป
8. ทดสอบโอนเงินเข้าทรูวอลเล็ต — เงินจะเข้า dashboard อัตโนมัติ

## TrueMoney Official Endpoints ที่รองรับ

| ในแอป TrueMoney | Endpoint | Env Token | Wrapper |
|----------------|----------|-----------|---------|
| แจ้งรับเงิน/เติมเงิน (Webhook) | POST your URL | `TMN_WEBHOOK_AUTH_KEY` + `TMN_WEBHOOK_JWT_SECRET` | `/api/webhook/truemoney?u=<userId>` |
| ตรวจสลิปโอนเงินใดๆ | `POST /validate/v1/p2p` | `TMN_P2P_VALIDATE_TOKEN` | `/api/slip/tmn-validate` |
| ตรวจสอบรายการรับเงินล่าสุด | `GET /account/v1/my-last-receive` | `TMN_LAST_RECEIVE_TOKEN` | `/api/tmn/sync` |
| ตรวจสอบยอดเงิน | `GET /account/v1/balance` | `TMN_BALANCE_TOKEN` | `/api/tmn/balance` |
| สร้างลิงก์รับเงิน | `POST /utils/v1/transfer-link-generator` | `TMN_TRANSFER_LINK_TOKEN` | `/api/tmn/transfer-link` |
| ดูข้อมูล QR บนสลิป TMN | `POST /utils/v1/trans-qr-info` | `TMN_QR_INFO_TOKEN` | `/api/tmn/qr-info` |

> ⚠️ ทุก endpoint ของ `apis.truemoneyservices.com` มี rate limit **30 req / 30 sec**
> ⚠️ Amount ทุก field ของ TrueMoney API เป็น **satang integer** (10000 = 100.00 บาท)
> ⚠️ Webhook body wrap: `{ "message": "<JWT>" }` ไม่ใช่ raw JWT

## Webhook Event Types (11 ชนิด)

**Inbound (เงินเข้า → credit user wallet):**

| event_type | ความหมาย | ตัวอย่าง |
|------------|---------|---------|
| `P2P` | โอนเข้าจาก TrueMoney user คนอื่น | เพื่อนโอนให้ |
| `MONEY_LINK` | รับซองอั่งเปา | เปิดซองทรูฯ ที่คนส่งให้ |
| `DIRECT_TOPUP` | เติมจากร้านค้า/ธนาคาร | 7-Eleven, ATM (มี field `channel`) |
| `PROMPTPAY_IN` | พร้อมเพย์เข้าวอลเล็ต | สแกน QR หรือโอน PromptPay |

**Outbound (เงินออก → log + auto-match withdrawal):**

| event_type | ความหมาย | Auto-match? |
|------------|---------|-------------|
| `BANK_WITHDRAW` | โอนเข้าบัญชีธนาคาร | ✅ match ด้วย dest_account |
| `SEND_P2P` | โอนหา TrueWallet คนอื่น | ✅ match ด้วยเบอร์ |
| `SEND_MONEY_LINK` | ส่งซองอั่งเปาออก | ❌ log |
| `SEND_MONEY_PLUS` | โอนเข้า Money Plus | ❌ log |
| `PROMPTPAY_TAG29` | พร้อมเพย์บุคคล | ❌ log |
| `PROMPTPAY_TAG30` | พร้อมเพย์ร้านค้า | ❌ log |
| `FEE_PAYMENT` | ค่าธรรมเนียม | ❌ log (3 ชนิดใน `merchant_name`) |

หน้า Dashboard มีหน้าเดียวที่รวมทุก service: **TMN Tools** (`/dashboard/tmn-tools`)
แสดงสถานะ token แต่ละตัว + ทดลองยิงได้ทันที

## API Reference

ทุก endpoint (ยกเว้น `/api/webhook/truemoney`) ใช้ Bearer API key:

```http
Authorization: Bearer sk_xxxxxxxxxxxxxxxx
```

### GET `/api/balance`

```json
{ "ok": true, "balance_satang": 12345, "balance_baht": 123.45 }
```

### POST `/api/slip/verify`

```bash
curl -X POST https://your-domain/api/slip/verify \
  -H "Authorization: Bearer sk_xxx" \
  -F "file=@slip.jpg" \
  -F "credit=1"
```

```json
{
  "ok": true,
  "method": "qr",
  "credited": true,
  "balance_satang": 56789,
  "data": {
    "amountSatang": 10000,
    "transRef": "2024010100012345",
    "sourceBank": "SCB",
    "targetBank": "KBANK",
    "sourceName": "ภัทรพล ...",
    "targetName": "ร้านค้า ABC",
    "datetime": "2025-01-15T12:34:56+07:00"
  }
}
```

### POST `/api/tmn/sync`

ดึงรายการรับเงินล่าสุดจาก TrueMoney official API
(`account/v1/my-last-receive`) มาเช็ค idempotency แล้วเติมเครดิตให้ user ถ้าเป็นรายการใหม่

ใช้เป็น **backup ของ webhook** — ถ้า webhook delivery หายให้ปุ่ม "Refresh now"
ในหน้า dashboard เรียก endpoint นี้แทน

```bash
curl -X POST https://your-domain/api/tmn/sync \
  -H "Authorization: Bearer sk_xxx"
```

```json
{
  "ok": true,
  "new": true,
  "transaction_id": "202508261015009876",
  "amount_satang": 5025,
  "amount_baht": 50.25,
  "sender_mobile": "0812345678",
  "received_time": "2024-04-01 14:20:34",
  "balance_satang": 12500
}
```

> ⚠️ TrueMoney rate limit: 30 req / 30 sec — อย่า poll ถี่กว่า 1 req/sec

### POST `/api/slip/tmn-validate`

เช็ค TrueMoney P2P slip ผ่าน official API (`apis.truemoneyservices.com/validate/v1/p2p`) —
เหมาะกับกรณีที่คุณมี trans_ref / QR payload อยู่แล้วและต้องการคำตอบที่
authoritative โดยไม่ต้องอัปโหลดรูป

```bash
curl -X POST https://your-domain/api/slip/tmn-validate \
  -H "Authorization: Bearer sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"trans_ref":"50040769563206","credit":true}'
```

ต้องตั้ง `TMN_P2P_VALIDATE_TOKEN` ใน env ก่อนใช้

### POST `/api/voucher/redeem`

```bash
curl -X POST https://your-domain/api/voucher/redeem \
  -H "Authorization: Bearer sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"link":"https://gift.truemoney.com/campaign/?v=XXXXXXXX","receiverPhone":"0812345678"}'
```

### POST `/api/withdraw`

```bash
curl -X POST https://your-domain/api/withdraw \
  -H "Authorization: Bearer sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"amount_satang":50000,"method":"tmn","dest_account":"0812345678","dest_name":"สมชาย"}'
```

### GET `/api/transactions?limit=50&kind=tmn_incoming`

ดูรายการเงินเข้า-ออก กรองตามประเภทได้ (`tmn_incoming`, `tmn_topup`,
`tmn_voucher`, `bank_slip`, `withdraw`)

## Deploy

ดูรายละเอียดที่ [DEPLOY.md](./DEPLOY.md) — รวม EasyPanel one-click deploy

## License

MIT — แต่ฟีเจอร์ที่เชื่อมกับ TrueMoney ขึ้นกับเงื่อนไขของ TrueMoney เอง
กรุณาใช้ภายในขอบเขตที่ทรูฯ อนุญาต
