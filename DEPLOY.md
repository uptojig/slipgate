# Deploy SlipGate บน EasyPanel

EasyPanel เป็น self-hosted PaaS ที่ใช้งานง่าย รัน Docker ใต้ฮูด
SlipGate ออกแบบมาให้ deploy ได้ด้วย Dockerfile + docker-compose สำเร็จรูป

## ข้อกำหนดเบื้องต้น

- VPS / Server (Ubuntu 22.04+ แนะนำ)
- โดเมนของคุณ ชี้ A record มาที่ server IP
- EasyPanel ติดตั้งแล้ว ([คู่มือ](https://easypanel.io/docs))

## ขั้นตอน

### 1. สร้าง project ใน EasyPanel

```
Projects → + Create → ตั้งชื่อ slipgate
```

### 2. เพิ่มบริการ PostgreSQL

```
+ Service → Postgres → Postgres 16
  ServiceName: db
  Database: slipgate
  Username: postgres
  Password: <สุ่ม>
```

EasyPanel จะแสดง internal hostname เช่น `slipgate_db` พร้อม connection string

### 3. สร้างบริการ App จาก GitHub

```
+ Service → App
  ServiceName: app
  Source: GitHub → เลือก repo SlipGate ของคุณ
  Build: Dockerfile (default)
  Mounts: ไม่ต้อง (stateless)
```

### 4. ตั้งค่า Environment

ใส่ environment variables ในแท็บ Environment ของ app service:

```ini
DATABASE_URL=postgres://postgres:<PASSWORD>@slipgate_db:5432/slipgate
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=https://slipgate.yourdomain.com
NEXT_PUBLIC_APP_URL=https://slipgate.yourdomain.com

# จากแอป TrueMoney → ทรูมันนี่ → ตั้งค่า API
TMN_WEBHOOK_AUTH_KEY=SDGKDF3435
TMN_WEBHOOK_JWT_SECRET=018db5a1098fde137da6856eab3d26d7

# (ตัวเลือก) Vision OCR ผ่าน Vercel AI Gateway
AI_GATEWAY_API_KEY=
SLIP_OCR_MODEL=anthropic/claude-haiku-4-5
```

### 5. Domain + SSL

```
แท็บ Domain → Add Domain → slipgate.yourdomain.com → Enable HTTPS
```

EasyPanel ออก Let's Encrypt cert ให้อัตโนมัติ

### 6. Deploy + Migrate

```
แท็บ Deploy → Deploy
```

หลังจาก deploy ขึ้นแล้ว ให้รัน migration จาก console ของ EasyPanel:

```bash
# ในแท็บ Console ของ app service
npm run db:push
```

### 7. ตั้งค่าใน TrueMoney Wallet

1. เปิดแอป TrueMoney → **ทรูมันนี่** → **ตั้งค่า API**
2. สมัครเข้าสู่ระบบ → ระบบจะแสดง **Authorization key** + **JWT secret**
3. คัดลอกทั้งสองค่ามาใส่ใน env ของ EasyPanel (`TMN_WEBHOOK_AUTH_KEY`, `TMN_WEBHOOK_JWT_SECRET`)
4. ในหน้า dashboard ของ SlipGate (login เข้าไป) ระบบจะแสดง webhook URL เฉพาะของ user
   เช่น `https://slipgate.yourdomain.com/api/webhook/truemoney?u=usr_xxx`
5. วาง URL ที่ได้ ลงในช่อง **Endpoint URL** ในแอปทรูมันนี่
6. เปิด toggle "รับเงิน" และ "เติมเงิน"
7. ทดสอบ — โอนเงินเข้าบัญชี TrueWallet ที่ตั้งค่าไว้ ระบบควรเติมเครดิตให้ทันที

### 8. Auto-deploy on push

แท็บ Git → **Auto-deploy on push** → เลือก branch `main`

ทุกครั้งที่ push code ใหม่ EasyPanel จะ pull + build + deploy ให้อัตโนมัติ

## ทางเลือกอื่นนอกจาก EasyPanel

### Vercel

```bash
vercel link
vercel env pull
vercel deploy --prod
```

> หมายเหตุ: ต้องใช้ external Postgres เช่น Neon, Supabase
> (Vercel Postgres ถูกยกเลิกแล้ว — ใช้ Marketplace integration แทน)

### Docker Compose (manual VPS)

```bash
git clone https://github.com/yourname/slipgate-app
cd slipgate-app
cp .env.example .env
nano .env  # แก้ค่าให้เรียบร้อย
docker-compose up -d --build
```

แนะนำใส่ Caddy / Nginx ด้านหน้าเพื่อจัดการ SSL

## การ Monitor + Backup

- **Database backup** — EasyPanel มี scheduled backup ในแท็บ Postgres service
- **Logs** — ดูได้จาก EasyPanel console แท็บ Logs
- **Health check** — endpoint `/api/balance` คืน 401 (server ทำงานอยู่) — ใช้กับ
  uptime monitor ได้

## Troubleshooting

| ปัญหา | สาเหตุ / วิธีแก้ |
|------|----------------|
| Webhook คืน 401 BAD_AUTH | `TMN_WEBHOOK_AUTH_KEY` ใน env ไม่ตรงกับใน app |
| Webhook คืน 401 BAD_JWT | `TMN_WEBHOOK_JWT_SECRET` ผิด หรือ JWT alg ไม่ใช่ HS256 |
| Slip OCR ไม่ทำงาน | ยังไม่ได้ตั้ง `AI_GATEWAY_API_KEY` — ระบบจะใช้ QR-only |
| Voucher คืน VOUCHER_OUT_OF_STOCK | ซองถูกใช้หมดแล้วจากฝั่ง TrueMoney |
| Voucher คืน TARGET_USER_NOT_FOUND | เบอร์ผู้รับยังไม่มีบัญชี TrueMoney Wallet |
