"use client";
import { useState, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type VerifyResult = {
  ok: boolean;
  method?: string;
  credited?: boolean;
  duplicated?: boolean;
  balance_satang?: number | null;
  data?: {
    amountSatang?: number | null;
    transRef?: string | null;
    sourceBank?: string | null;
    targetBank?: string | null;
    sourceName?: string | null;
    targetName?: string | null;
    datetime?: string | null;
  };
  error?: string;
};

export function SlipUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [credit, setCredit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (credit) form.append("credit", "1");
      const res = await fetch("/api/slip/verify", { method: "POST", body: form });
      const json = (await res.json()) as VerifyResult;
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="card p-8 border-dashed border-2 border-zinc-300 cursor-pointer hover:border-brand-600 transition"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <div className="flex flex-col items-center text-center">
          <Upload className="h-10 w-10 text-zinc-400 mb-3" />
          <p className="font-medium">ลากไฟล์สลิปมาวาง หรือ คลิกเพื่อเลือก</p>
          <p className="text-xs text-zinc-500 mt-1">JPG, PNG, WebP — สูงสุด 8MB</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={credit}
          onChange={(e) => setCredit(e.target.checked)}
          className="rounded border-zinc-300"
        />
        เติมเครดิตเข้ากระเป๋าอัตโนมัติเมื่อตรวจสลิปสำเร็จ
      </label>

      {preview && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-3">
            <img src={preview} alt="slip" className="w-full rounded-md object-contain max-h-96" />
          </div>
          <div className="card p-5">
            {loading && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังประมวลผล…
              </div>
            )}
            {result && <ResultPanel r={result} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPanel({ r }: { r: VerifyResult }) {
  if (!r.ok) {
    return (
      <div className="text-red-700">
        <div className="flex items-center gap-2 font-semibold mb-2">
          <AlertCircle className="h-5 w-5" /> ตรวจสอบไม่สำเร็จ
        </div>
        <p className="text-sm">{r.error ?? "ไม่ทราบสาเหตุ"}</p>
      </div>
    );
  }
  if (r.duplicated) {
    return (
      <div className="text-amber-700">
        <div className="flex items-center gap-2 font-semibold mb-2">
          <AlertCircle className="h-5 w-5" /> สลิปนี้เคยถูกตรวจไปแล้ว
        </div>
        <p className="text-sm">เลขอ้างอิงซ้ำ: {r.data?.transRef}</p>
      </div>
    );
  }
  const baht = r.data?.amountSatang ? r.data.amountSatang / 100 : null;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 text-emerald-700 font-semibold">
        <CheckCircle2 className="h-5 w-5" /> ตรวจสำเร็จ ({r.method?.toUpperCase()})
      </div>
      {r.credited && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-emerald-700">
          เติมเครดิตเรียบร้อย ยอดปัจจุบัน:{" "}
          {(r.balance_satang ?? 0).toLocaleString("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2 })}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-y-1">
        <Field k="จำนวนเงิน" v={baht != null ? `${baht.toLocaleString()} บาท` : "—"} />
        <Field k="เลขอ้างอิง" v={r.data?.transRef ?? "—"} />
        <Field k="ธนาคารต้นทาง" v={r.data?.sourceBank ?? "—"} />
        <Field k="ธนาคารปลายทาง" v={r.data?.targetBank ?? "—"} />
        <Field k="ชื่อผู้โอน" v={r.data?.sourceName ?? "—"} />
        <Field k="ชื่อผู้รับ" v={r.data?.targetName ?? "—"} />
        <Field k="เวลา" v={r.data?.datetime ?? "—"} />
      </dl>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-zinc-900 font-medium break-all">{v}</dd>
    </>
  );
}
