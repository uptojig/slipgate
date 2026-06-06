"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tmn/sync", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setMsg(json.message ?? json.error ?? "ดึงรายการไม่สำเร็จ");
      } else if (!json.new) {
        setMsg(`ไม่มีรายการใหม่ (${json.transaction_id})`);
      } else {
        setMsg(`เติมเครดิต ${(json.amount_satang / 100).toLocaleString("th-TH")} บาท จาก ${json.sender_mobile ?? "ไม่ทราบ"}`);
        router.refresh();
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={sync} disabled={loading} className="btn-secondary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        ดึงรายการล่าสุดจาก TMN
      </button>
      {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}
