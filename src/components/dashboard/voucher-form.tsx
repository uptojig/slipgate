"use client";
import { useState } from "react";
import { Gift, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type RedeemResponse = {
  ok: boolean;
  amount_satang?: number;
  amount_baht?: string;
  balance_satang?: number;
  error?: string;
  message?: string;
};

export function VoucherForm() {
  const [link, setLink] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<RedeemResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setRes(null);
    try {
      const resp = await fetch("/api/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link, receiverPhone: phone }),
      });
      const json = (await resp.json()) as RedeemResponse;
      setRes(json);
      if (json.ok) {
        setLink("");
      }
    } catch (e) {
      setRes({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div>
        <label className="label" htmlFor="link">ลิงก์อั่งเปา หรือ โค้ด</label>
        <input
          id="link"
          className="input font-mono text-sm"
          placeholder="https://gift.truemoney.com/campaign/?v=..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="phone">เบอร์รับเงิน (TrueMoney Wallet)</label>
        <input
          id="phone"
          className="input"
          placeholder="08XXXXXXXX"
          pattern="0\d{9}"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          required
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {loading ? "กำลังรับซอง…" : "รับซองอั่งเปา"}
      </button>

      {res && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            res.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {res.ok ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">รับซองสำเร็จ!</p>
                <p>ได้รับ {res.amount_baht} บาท · ยอดปัจจุบัน {((res.balance_satang ?? 0) / 100).toLocaleString("th-TH")} บาท</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">{res.message ?? "รับซองไม่สำเร็จ"}</p>
                {res.error && <p className="text-xs opacity-70">{res.error}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
