import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/credit/ledger";
import { db, schema } from "@/db";
import { formatBaht, newId, bahtToSatang } from "@/lib/utils";

async function requestWithdraw(formData: FormData) {
  "use server";
  const user = await requireUser();
  const amountBaht = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "tmn");
  const dest = String(formData.get("destAccount") ?? "");
  const destName = String(formData.get("destName") ?? "");
  const destBank = String(formData.get("destBank") ?? "");

  if (!amountBaht || amountBaht < 20) return redirect("/dashboard/withdraw?error=min");
  if (!dest) return redirect("/dashboard/withdraw?error=dest");

  const amountSatang = bahtToSatang(amountBaht);
  const balance = await getBalance(user.id);
  if (balance < amountSatang) return redirect("/dashboard/withdraw?error=balance");

  await db.insert(schema.withdrawals).values({
    id: newId("wd"),
    userId: user.id,
    amountSatang,
    method: method === "bank" ? "bank" : "tmn",
    destAccount: dest,
    destName: destName || null,
    destBank: destBank || null,
    status: "requested",
  });

  redirect("/dashboard/withdraw?ok=1");
}

export default async function WithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const balance = await getBalance(user.id);

  const history = await db.query.withdrawals.findMany({
    where: eq(schema.withdrawals.userId, user.id),
    orderBy: [desc(schema.withdrawals.createdAt)],
    limit: 50,
  });

  const errorMsg: Record<string, string> = {
    min: "ขั้นต่ำ 20 บาท",
    dest: "กรุณาระบุปลายทาง",
    balance: "ยอดเงินไม่พอ",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ถอนเงิน</h1>
        <p className="text-sm text-zinc-600">
          ยอดที่ถอนได้: <span className="font-semibold text-brand-700">{formatBaht(balance)}</span>
        </p>
      </div>

      {sp.ok && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          ส่งคำขอถอนเรียบร้อย — แอดมินจะดำเนินการภายใน 24 ชม.
        </div>
      )}
      {sp.error && errorMsg[sp.error] && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errorMsg[sp.error]}
        </div>
      )}

      <form action={requestWithdraw} className="card p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">ช่องทาง</label>
            <select className="input" name="method" defaultValue="tmn">
              <option value="tmn">TrueMoney Wallet</option>
              <option value="bank">บัญชีธนาคาร</option>
            </select>
          </div>
          <div>
            <label className="label">จำนวนเงิน (บาท)</label>
            <input className="input" name="amount" type="number" min={20} step="0.01" required />
          </div>
          <div>
            <label className="label">ปลายทาง (เบอร์ / เลขบัญชี)</label>
            <input className="input" name="destAccount" required />
          </div>
          <div>
            <label className="label">ชื่อบัญชี</label>
            <input className="input" name="destName" />
          </div>
          <div className="md:col-span-2">
            <label className="label">ธนาคาร (ถ้าเลือกธนาคาร)</label>
            <input className="input" name="destBank" placeholder="เช่น KBANK, SCB, BBL" />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full py-2.5">ส่งคำขอถอน</button>
        <p className="text-xs text-zinc-500">
          * การถอนปัจจุบันเป็นแบบ manual approve ภายใน 24 ชม.
          ในอนาคต TrueMoney Official API จะเปิดให้ยืนยันรายการถอนอัตโนมัติ (ตอนนี้ฝั่งทรูฯ ปิดปรับปรุง)
        </p>
      </form>

      <div className="card">
        <div className="px-5 py-3 border-b border-zinc-200 font-semibold">ประวัติการถอน</div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-5 py-2">วันที่</th>
              <th className="px-5 py-2">ช่องทาง</th>
              <th className="px-5 py-2">ปลายทาง</th>
              <th className="px-5 py-2 text-right">จำนวน</th>
              <th className="px-5 py-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">ยังไม่มีรายการ</td></tr>}
            {history.map((w) => (
              <tr key={w.id} className="border-t border-zinc-100">
                <td className="px-5 py-2">{new Date(w.createdAt).toLocaleString("th-TH")}</td>
                <td className="px-5 py-2">{w.method === "tmn" ? "TrueWallet" : w.destBank ?? "ธนาคาร"}</td>
                <td className="px-5 py-2 font-mono text-xs">{w.destAccount}</td>
                <td className="px-5 py-2 text-right font-mono">{formatBaht(w.amountSatang)}</td>
                <td className="px-5 py-2">{w.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
