import Link from "next/link";
import {
  ShieldCheck,
  Wallet,
  QrCode,
  Gift,
  Webhook,
  ScanLine,
  ArrowRight,
} from "lucide-react";
import { Header } from "@/components/landing/header";

const LANDING_NAV = [
  { href: "#features", label: "ฟีเจอร์" },
  { href: "#how", label: "วิธีใช้งาน" },
  { href: "#pricing", label: "ราคา" },
  { href: "/docs", label: "เอกสาร API" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Header nav={LANDING_NAV} />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section className="container-page py-16 md:py-24 text-center">
      <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-xs font-medium">
        <ShieldCheck className="h-3.5 w-3.5" /> ใช้ TrueMoney Official Webhook + QR สลิปจริง
      </p>
      <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight">
        ตรวจสลิป &amp; เติมเครดิต
        <span className="block text-brand-600">อัตโนมัติทุกธนาคาร + TrueWallet</span>
      </h1>
      <p className="mt-6 text-lg text-zinc-600 max-w-2xl mx-auto">
        ระบบเดียวจบ — รับ Webhook ทรูมันนี่ตัวจริง, ตรวจ QR บนสลิปธนาคาร,
        รับซองอั่งเปา, จัดการเครดิตผู้ใช้งานพร้อม API สำหรับเว็บคุณ
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/register" className="btn-primary px-6 py-3 text-base">
          เริ่มใช้งานฟรี <ArrowRight className="h-4 w-4" />
        </Link>
        <a href="#features" className="btn-secondary px-6 py-3 text-base">
          ดูฟีเจอร์
        </a>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        ไม่ต้องผูกบัตร · ฟรี 100 สลิป/เดือน · เกินโควต้า ฿0.20/สลิป จ่ายผ่าน TrueWallet
      </p>
    </section>
  );
}

const FEATURES = [
  {
    icon: Webhook,
    title: "TrueMoney Official Webhook",
    desc: "ตั้งค่า Endpoint URL ในแอปทรูมันนี่ครั้งเดียว แล้วระบบจะ verify JWT HS256 + auto-credit user ทุกครั้งที่มีเงินเข้า",
  },
  {
    icon: QrCode,
    title: "อ่าน QR บนสลิปทุกธนาคาร",
    desc: "Decode EMVCo TLV ที่ฝังบนสลิป BBL / KBANK / SCB / KTB / TTB / BAY / GSB ฯลฯ พร้อมตรวจ trans_ref ซ้ำ",
  },
  {
    icon: ScanLine,
    title: "OCR ด้วย Vision Model",
    desc: "ใช้ Vercel AI Gateway → Claude/GPT vision อ่านสลิปที่ QR เสียหายหรือถูกครอบ ดึงยอด ผู้โอน เวลาได้แม่นยำ",
  },
  {
    icon: Gift,
    title: "รับซองอั่งเปา TrueWallet",
    desc: "วาง gift link หรือโค้ดอั่งเปา → ระบบเช็คซ้ำ → redeem ผ่าน endpoint ทางการ → เติมเครดิตให้อัตโนมัติ",
  },
  {
    icon: Wallet,
    title: "Credit Ledger ในตัว",
    desc: "ทุกรายการเข้า/ออกถูกบันทึกเป็น double-entry, idempotent ป้องกัน double-credit แม้ webhook ส่งซ้ำ",
  },
  {
    icon: ShieldCheck,
    title: "API Key + Webhook ปลอดภัย",
    desc: "ออก API key สำหรับเว็บคุณ + เซ็นทุก request ด้วย JWT, log ทุก event เพื่อ audit",
  },
];

function Features() {
  return (
    <section id="features" className="bg-white py-20 border-y border-zinc-200">
      <div className="container-page">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">ทุกอย่างที่ระบบเติมเครดิตยุคใหม่ต้องมี</h2>
          <p className="mt-3 text-zinc-600">
            ออกแบบมาให้ developer ต่อ API ภายใน 5 นาที และใช้ใน production ได้จริง
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="container-page py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-bold">ใช้งานง่ายใน 3 ขั้นตอน</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            n: "1",
            title: "สมัครและออก API Key",
            desc: "สมัครสมาชิก → สร้าง API key สำหรับเว็บคุณ → คัดลอก Endpoint URL ของคุณ",
          },
          {
            n: "2",
            title: "ตั้งค่าในแอป TrueMoney",
            desc: "แอปทรูมันนี่ → ทรูมันนี่ → ตั้งค่า API → วาง Endpoint URL ของคุณ และคัดลอก JWT secret มาใส่ใน Dashboard",
          },
          {
            n: "3",
            title: "เชื่อมระบบเว็บคุณ",
            desc: "POST /api/slip/verify สำหรับเช็คสลิป, POST /api/voucher/redeem สำหรับอั่งเปา, GET /api/balance ดูยอด",
          },
        ].map((s) => (
          <div key={s.n} className="relative card p-6">
            <div className="absolute -top-4 -left-4 h-10 w-10 rounded-full bg-brand-600 text-white text-lg font-bold flex items-center justify-center shadow-lg">
              {s.n}
            </div>
            <h3 className="font-semibold text-lg mt-2">{s.title}</h3>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const compareRows = [
    { feat: "ราคาต่อสลิป", us: "฿0.20", easyslip: "฿0.50", slipok: "฿0.40" },
    { feat: "ฟรีต่อเดือน", us: "100 สลิป", easyslip: "50 สลิป", slipok: "—" },
    { feat: "TMN Official Validate API", us: "✓", easyslip: "—", slipok: "—" },
    { feat: "Vision AI OCR (Claude/GPT)", us: "✓", easyslip: "Tesseract", slipok: "Tesseract" },
    { feat: "Bulk verify (50 สลิป/call)", us: "✓", easyslip: "—", slipok: "—" },
    { feat: "Customer Webhook + HMAC", us: "✓", easyslip: "✓", slipok: "✓" },
    { feat: "Sandbox key (sk_test_*)", us: "✓", easyslip: "—", slipok: "✓" },
  ];

  return (
    <section id="pricing" className="bg-white py-20 border-t border-zinc-200">
      <div className="container-page">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Pay-as-you-go ฿0.20 ต่อสลิป</h2>
          <p className="mt-3 text-zinc-600">
            ไม่มี subscription · ไม่มีค่าธรรมเนียมรายเดือน · ใช้เท่าไหร่จ่ายเท่านั้น
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          <div className="card p-6 flex flex-col">
            <div className="text-sm font-medium text-zinc-500">เริ่มต้นฟรี</div>
            <div className="mt-2 text-4xl font-bold">100 <span className="text-base font-medium text-zinc-500">สลิป/เดือน</span></div>
            <p className="text-sm text-zinc-600 mt-2">รีเซ็ตอัตโนมัติทุกวันที่ 1</p>
            <ul className="space-y-2 text-sm text-zinc-700 mt-4 mb-6">
              <li className="flex gap-2"><span className="text-brand-600">✓</span> ไม่ต้องผูกบัตร</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> เข้าทุก endpoint</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> Sandbox ไม่จำกัด</li>
            </ul>
            <Link href="/register" className="btn-secondary mt-auto">เริ่มฟรี</Link>
          </div>

          <div className="card p-6 flex flex-col border-brand-600 shadow-lg ring-2 ring-brand-600/20">
            <div className="text-sm font-medium text-brand-700">เกินโควต้าฟรี</div>
            <div className="mt-2 text-4xl font-bold">฿0.20 <span className="text-base font-medium text-zinc-500">/ สลิป</span></div>
            <p className="text-sm text-zinc-600 mt-2">คิดต่อ verify สำเร็จ — ล้มเหลวไม่หัก</p>
            <ul className="space-y-2 text-sm text-zinc-700 mt-4 mb-6">
              <li className="flex gap-2"><span className="text-brand-600">✓</span> เติมเครดิตผ่าน TrueWallet ทันที</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> เครดิตไม่หมดอายุ</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> Bulk verify ลด overhead</li>
            </ul>
            <Link href="/register" className="btn-primary mt-auto">สร้างบัญชี</Link>
          </div>

          <div className="card p-6 flex flex-col">
            <div className="text-sm font-medium text-zinc-500">Enterprise</div>
            <div className="mt-2 text-4xl font-bold">Custom</div>
            <p className="text-sm text-zinc-600 mt-2">ปริมาณ &gt; 50,000 สลิป/เดือน</p>
            <ul className="space-y-2 text-sm text-zinc-700 mt-4 mb-6">
              <li className="flex gap-2"><span className="text-brand-600">✓</span> ส่วนลด volume</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> SLA 99.9% + dedicated support</li>
              <li className="flex gap-2"><span className="text-brand-600">✓</span> On-prem deploy option</li>
            </ul>
            <Link href="/contact" className="btn-secondary mt-auto">ติดต่อทีมขาย</Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <h3 className="text-xl font-bold text-center mb-4">เทียบกับคู่แข่ง</h3>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left">
                <tr>
                  <th className="px-5 py-3 text-zinc-600">ฟีเจอร์</th>
                  <th className="px-5 py-3 text-brand-700">SlipGate</th>
                  <th className="px-5 py-3 text-zinc-600">EasySlip</th>
                  <th className="px-5 py-3 text-zinc-600">SlipOK</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((r) => (
                  <tr key={r.feat} className="border-t border-zinc-100">
                    <td className="px-5 py-2.5 text-zinc-700">{r.feat}</td>
                    <td className="px-5 py-2.5 font-semibold text-brand-700">{r.us}</td>
                    <td className="px-5 py-2.5 text-zinc-600">{r.easyslip}</td>
                    <td className="px-5 py-2.5 text-zinc-600">{r.slipok}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-zinc-900 text-zinc-400 py-12">
      <div className="container-page flex flex-col md:flex-row justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 text-white font-bold">
            <span className="inline-block h-5 w-5 rounded bg-brand-600" /> SlipGate
          </div>
          <p className="mt-3 text-sm max-w-xs">
            ระบบตรวจสอบสลิปและเติมเครดิตอัตโนมัติ สำหรับร้านค้าออนไลน์ในไทย
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <h4 className="text-white font-semibold mb-2">ผลิตภัณฑ์</h4>
            <ul className="space-y-1">
              <li><a href="#features">ฟีเจอร์</a></li>
              <li><a href="#pricing">ราคา</a></li>
              <li><a href="/docs">API Docs</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2">บริษัท</h4>
            <ul className="space-y-1">
              <li><a href="/contact">ติดต่อเรา</a></li>
              <li><a href="/terms">เงื่อนไขการใช้</a></li>
              <li><a href="/privacy">นโยบายความเป็นส่วนตัว</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-2">นักพัฒนา</h4>
            <ul className="space-y-1">
              <li><a href="/docs/webhook">Webhook</a></li>
              <li><a href="/docs/voucher">Voucher</a></li>
              <li><a href="/docs/slip">Slip Verify</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="container-page mt-8 pt-6 border-t border-zinc-800 text-xs flex justify-between">
        <span>© {new Date().getFullYear()} SlipGate</span>
        <span>Made with ♥ in Thailand</span>
      </div>
    </footer>
  );
}
