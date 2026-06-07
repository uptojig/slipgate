"use client";
import { useRef, useState } from "react";
import {
  Wallet,
  Webhook,
  Link2,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  Sparkles,
} from "lucide-react";

type Configured = {
  p2pValidate: boolean;
  lastReceive: boolean;
  balance: boolean;
  transferLink: boolean;
  qrInfo: boolean;
  webhook: boolean;
};

const TABS = [
  { id: "sync",     label: "Sync รายการล่าสุด", icon: RefreshCw,    flag: "lastReceive" },
  { id: "balance",  label: "ยอดเงิน",            icon: Wallet,       flag: "balance" },
  { id: "validate", label: "เช็คสลิป P2P",       icon: ShieldCheck,  flag: "p2pValidate" },
  { id: "link",     label: "สร้างลิงก์รับเงิน",  icon: Link2,        flag: "transferLink" },
  { id: "qr",       label: "อ่าน QR สลิป TMN",   icon: QrCode,       flag: "qrInfo" },
] as const;

export function TmnToolsPanel({ configured }: { configured: Configured }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("sync");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => {
          const isReady = configured[t.flag as keyof Configured];
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${
                active
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {!isReady && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${active ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
                  ยังไม่ตั้ง token
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="card p-5">
        {tab === "sync" && <SyncTool ready={configured.lastReceive} />}
        {tab === "balance" && <BalanceTool ready={configured.balance} />}
        {tab === "validate" && <ValidateTool ready={configured.p2pValidate} />}
        {tab === "link" && <LinkTool ready={configured.transferLink} />}
        {tab === "qr" && <QrTool ready={configured.qrInfo} />}
      </div>
    </div>
  );
}

function NeedToken({ envName }: { envName: string }) {
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
      ต้องตั้ง <code className="bg-white px-1 rounded border border-amber-200">{envName}</code> ใน .env ก่อน
      <p className="text-xs mt-1">
        เปิดแอป TrueMoney → ทรูมันนี่ → เลือกบริการที่ต้องการ → คัดลอก Bearer Token มาวางใน .env
      </p>
    </div>
  );
}

// ── 1. Sync (my-last-receive) ─────────────────────────────────────────
function SyncTool({ ready }: { ready: boolean }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  async function run() {
    setLoading(true);
    setRes(null);
    const r = await fetch("/api/tmn/sync", { method: "POST" });
    setRes(await r.json());
    setLoading(false);
  }
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-3">ดึงรายการรับเงินล่าสุดจาก TMN — ใช้เป็น backup ของ webhook</p>
      {!ready ? (
        <NeedToken envName="TMN_LAST_RECEIVE_TOKEN" />
      ) : (
        <>
          <button onClick={run} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            ดึงรายการล่าสุด
          </button>
          {res && <Result r={res} />}
        </>
      )}
    </div>
  );
}

// ── 2. Balance ────────────────────────────────────────────────────────
function BalanceTool({ ready }: { ready: boolean }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  async function run() {
    setLoading(true);
    setRes(null);
    const r = await fetch("/api/tmn/balance");
    setRes(await r.json());
    setLoading(false);
  }
  return (
    <div>
      <p className="text-sm text-zinc-600 mb-3">เช็คยอดเงินคงเหลือใน TrueMoney Wallet แบบ real-time</p>
      {!ready ? (
        <NeedToken envName="TMN_BALANCE_TOKEN" />
      ) : (
        <>
          <button onClick={run} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            ดูยอดเงิน
          </button>
          {res?.ok && (
            <div className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 p-4">
              <div className="text-3xl font-bold text-emerald-700">
                ฿{Number(res.balance_baht).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-600 mt-1">
                {res.mobile_no} · อัปเดตเมื่อ {res.updated_at}
              </div>
            </div>
          )}
          {res && !res.ok && <Result r={res} />}
        </>
      )}
    </div>
  );
}

// ── 3. P2P Validate ───────────────────────────────────────────────────
function ValidateTool({ ready }: { ready: boolean }) {
  const [form, setForm] = useState({
    sender_mobile: "",
    receiver_mobile: "",
    transaction_id: "",
    amount_baht: "",
    transaction_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);

  // OCR-prefill state
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSummary, setOcrSummary] = useState<string | null>(null);

  /** Format an ISO datetime as "yyyy-MM-dd HH:mm" in Asia/Bangkok. */
  function formatDateInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    // shift to +07
    const ms = d.getTime() + 7 * 3600 * 1000;
    const x = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
  }

  /** Pull last 10 digits from any masked account string. */
  function lastDigits(s: string | null | undefined): string {
    if (!s) return "";
    const d = s.replace(/\D+/g, "");
    return d.slice(-10);
  }

  async function handleFile(file: File) {
    setOcrError(null);
    setOcrSummary(null);
    setPreview(URL.createObjectURL(file));
    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/slip/verify", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) {
        setOcrError(j.error ?? "OCR ไม่สำเร็จ");
        return;
      }
      const d = j.data ?? {};
      const next = {
        sender_mobile: lastDigits(d.sourceAccount) || form.sender_mobile,
        receiver_mobile: lastDigits(d.targetAccount) || form.receiver_mobile,
        transaction_id: d.transRef ?? form.transaction_id,
        amount_baht:
          typeof d.amountSatang === "number"
            ? (d.amountSatang / 100).toFixed(2)
            : form.amount_baht,
        transaction_date: formatDateInput(d.datetime) || form.transaction_date,
      };
      setForm(next);
      const filled = Object.entries(next).filter(([k, v]) => v && v !== (form as any)[k]).length;
      setOcrSummary(`ดึงข้อมูลจากสลิปแล้ว — เติม ${filled} ฟิลด์ (วิธี: ${j.method})`);
    } catch (e) {
      setOcrError((e as Error).message);
    } finally {
      setOcrLoading(false);
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRes(null);
    const r = await fetch("/api/slip/tmn-validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_mobile: form.sender_mobile || undefined,
        receiver_mobile: form.receiver_mobile,
        transaction_id: form.transaction_id,
        amount_satang: Math.round(Number(form.amount_baht) * 100),
        transaction_date: form.transaction_date,
        credit: false,
      }),
    });
    setRes(await r.json());
    setLoading(false);
  }

  if (!ready) return <NeedToken envName="TMN_P2P_VALIDATE_TOKEN" />;

  return (
    <form onSubmit={run} className="space-y-4">
      {/* OCR auto-fill dropzone */}
      <div className="rounded-md border border-dashed border-zinc-300 p-4 bg-zinc-50">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 w-28 h-28 rounded-md border border-zinc-200 bg-white hover:border-brand-400 hover:bg-brand-50 transition-colors"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="slip preview" className="max-h-full max-w-full object-contain rounded" />
            ) : (
              <>
                <Upload className="h-6 w-6 text-zinc-400" />
                <span className="text-xs text-zinc-500">อัปโหลดสลิป</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="flex-1 min-w-0 text-sm">
            <div className="flex items-center gap-2 text-zinc-700 font-medium">
              <Sparkles className="h-4 w-4 text-brand-600" />
              อ่านสลิปอัตโนมัติ — เติมช่องด้านล่างให้
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              วางรูปสลิป TMN → ระบบจะดึง <code className="bg-white px-1 rounded">trans_id</code>, จำนวน, เบอร์ผู้รับ, วันเวลาให้
            </p>
            {ocrLoading && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-600">
                <Loader2 className="h-3 w-3 animate-spin" /> กำลังอ่านสลิป…
              </div>
            )}
            {ocrError && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                <AlertCircle className="h-3 w-3" /> {ocrError}
              </div>
            )}
            {ocrSummary && !ocrLoading && !ocrError && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                <CheckCircle2 className="h-3 w-3" /> {ocrSummary}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-zinc-600">
        ใส่ข้อมูลจากสลิป TMN เพื่อตรวจสอบ — ตรวจ <code className="text-xs bg-zinc-100 px-1 rounded">receiver_mobile</code> แค่ 4 ตัวท้าย (ส่ง 0000xxxx ก็ได้)
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input k="sender_mobile (optional)" placeholder="0812345678" v={form.sender_mobile}
          on={(v) => setForm({ ...form, sender_mobile: v })} />
        <Input k="receiver_mobile *" placeholder="0898765432" v={form.receiver_mobile}
          on={(v) => setForm({ ...form, receiver_mobile: v })} required />
        <Input k="transaction_id *" placeholder="50027287091246" v={form.transaction_id}
          on={(v) => setForm({ ...form, transaction_id: v })} required />
        <Input k="amount (บาท) *" placeholder="200.25" v={form.amount_baht} type="number" step="0.01"
          on={(v) => setForm({ ...form, amount_baht: v })} required />
        <Input k="transaction_date * (yyyy-mm-dd HH:mm)" placeholder="2024-04-01 14:20"
          v={form.transaction_date} on={(v) => setForm({ ...form, transaction_date: v })} required />
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        ตรวจสอบ
      </button>
      {res && <Result r={res} />}
    </form>
  );
}

// ── 4. Transfer link ──────────────────────────────────────────────────
function LinkTool({ ready }: { ready: boolean }) {
  const [form, setForm] = useState({ mobile: "", amount: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRes(null);
    const r = await fetch("/api/tmn/transfer-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile_number: form.mobile,
        amount: Number(form.amount),
        message: form.message || undefined,
      }),
    });
    setRes(await r.json());
    setLoading(false);
  }

  if (!ready) return <NeedToken envName="TMN_TRANSFER_LINK_TOKEN" />;

  return (
    <form onSubmit={run} className="space-y-3">
      <p className="text-sm text-zinc-600">สร้างลิงก์ tmn.app.link ให้ลูกค้ากดเปิดแอป → โอนเงินแบบ pre-filled (สูงสุด 50,000)</p>
      <div className="grid md:grid-cols-2 gap-3">
        <Input k="mobile_number *" placeholder="0812345678" v={form.mobile}
          on={(v) => setForm({ ...form, mobile: v })} required />
        <Input k="amount (บาท) *" placeholder="100.50" v={form.amount} type="number" step="0.01"
          on={(v) => setForm({ ...form, amount: v })} required />
        <div className="md:col-span-2">
          <Input k="message (≤140 ตัวอักษร)" placeholder="เติมเกมร้าน A" v={form.message}
            on={(v) => setForm({ ...form, message: v })} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        สร้างลิงก์
      </button>
      {res?.ok && (
        <div className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 p-4 space-y-3">
          <code className="block bg-white border border-emerald-200 rounded px-3 py-2 text-xs break-all">{res.url}</code>
          <img src={res.qr_url} alt="QR" className="h-48 w-48 bg-white rounded border border-emerald-200" />
        </div>
      )}
      {res && !res.ok && <Result r={res} />}
    </form>
  );
}

// ── 5. QR info ────────────────────────────────────────────────────────
function QrTool({ ready }: { ready: boolean }) {
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRes(null);
    const r = await fetch("/api/tmn/qr-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_value: qr }),
    });
    setRes(await r.json());
    setLoading(false);
  }

  if (!ready) return <NeedToken envName="TMN_QR_INFO_TOKEN" />;

  return (
    <form onSubmit={run} className="space-y-3">
      <p className="text-sm text-zinc-600">วาง raw value ของ QR ที่อ่านจากสลิปทรูมันนี่ (61 หลัก) ให้ระบบ decode</p>
      <textarea
        value={qr}
        onChange={(e) => setQr(e.target.value)}
        className="input font-mono text-xs"
        rows={3}
        required
        placeholder="00490002010102010203P2P03145004849403854604080412202591041751"
      />
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
        Decode
      </button>
      {res && <Result r={res} />}
    </form>
  );
}

function Input(props: {
  k: string; v: string; placeholder?: string; required?: boolean; type?: string; step?: string;
  on: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="label">{props.k}</span>
      <input
        className="input"
        value={props.v}
        onChange={(e) => props.on(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        type={props.type}
        step={props.step}
      />
    </label>
  );
}

function Result({ r }: { r: any }) {
  const ok = r.ok;
  return (
    <div
      className={`mt-4 rounded-md border px-4 py-3 text-sm ${
        ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      <div className="flex items-center gap-2 font-medium mb-2">
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        {ok ? "สำเร็จ" : r.error ?? "ล้มเหลว"}
      </div>
      <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(r, null, 2)}</pre>
    </div>
  );
}
