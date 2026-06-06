"use client";
import { useState } from "react";
import { Loader2, AlertCircle, Wallet, QrCode } from "lucide-react";

type TransferLinkResponse = {
  ok: boolean;
  url?: string;
  qr_url?: string;
  error?: string;
  message?: string;
};

type Props = {
  userId: string;
  adminPhone: string;
};

const PRESETS = [50, 100, 200, 500, 1000];

export function TopupForm({ userId, adminPhone }: Props) {
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<TransferLinkResponse | null>(null);

  function pick(value: number) {
    setAmount(value);
    setCustom("");
    setRes(null);
  }

  function setCustomAmount(v: string) {
    const digits = v.replace(/[^\d.]/g, "");
    setCustom(digits);
    const n = Number(digits);
    setAmount(Number.isFinite(n) && n > 0 ? n : null);
    setRes(null);
  }

  async function generate() {
    if (!amount || amount <= 0) return;
    if (!adminPhone) {
      setRes({ ok: false, message: "ยังไม่ได้ตั้งค่าเบอร์ผู้รับ (NEXT_PUBLIC_ADMIN_TMN_PHONE)" });
      return;
    }
    setLoading(true);
    setRes(null);
    try {
      const resp = await fetch("/api/tmn/transfer-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile_number: adminPhone,
          amount,
          message: `SlipGate credit ${userId}`,
        }),
      });
      const json = (await resp.json()) as TransferLinkResponse;
      setRes(json);
    } catch (e) {
      setRes({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div>
          <label className="label">เลือกจำนวนเงิน</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pick(p)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  amount === p && !custom
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                ฿{p.toLocaleString("th-TH")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="custom">หรือระบุจำนวนเอง (บาท)</label>
          <input
            id="custom"
            inputMode="decimal"
            className="input"
            placeholder="เช่น 350"
            value={custom}
            onChange={(e) => setCustomAmount(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={loading || !amount}
          className="btn-primary w-full py-2.5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          {loading
            ? "กำลังสร้างลิงก์…"
            : amount
              ? `สร้างลิงก์เติม ฿${amount.toLocaleString("th-TH")}`
              : "เลือกจำนวนก่อน"}
        </button>

        <p className="text-xs text-zinc-500">
          เมื่อโอนเสร็จ ระบบจะเติมเครดิตให้อัตโนมัติภายใน 30 วินาที (ผ่าน TMN webhook)
        </p>
      </div>

      {res && !res.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <p className="font-semibold">{res.message ?? "สร้างลิงก์ไม่สำเร็จ"}</p>
              {res.error && <p className="text-xs opacity-70">{res.error}</p>}
            </div>
          </div>
        </div>
      )}

      {res && res.ok && res.url && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Wallet className="h-4 w-4" /> สแกน QR หรือกดลิงก์เพื่อเปิดแอป TrueMoney
          </div>
          {res.qr_url && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={res.qr_url}
                alt="TrueMoney transfer QR"
                width={240}
                height={240}
                className="rounded-md border border-zinc-200"
              />
            </div>
          )}
          <a
            href={res.url}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-secondary w-full break-all"
          >
            {res.url}
          </a>
          <p className="text-xs text-zinc-500 text-center">
            อ้างอิงในข้อความ: <code className="bg-zinc-100 px-1 rounded">SlipGate credit {userId}</code>
          </p>
        </div>
      )}
    </div>
  );
}
