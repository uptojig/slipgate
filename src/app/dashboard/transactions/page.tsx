import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { formatBaht } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  tmn_incoming: "โอนเข้า TrueWallet",
  tmn_topup: "เติมเงินจากธนาคาร",
  tmn_voucher: "ซองอั่งเปา",
  bank_slip: "สลิปธนาคาร",
  withdraw: "ถอน",
  adjust: "ปรับยอด",
};

export default async function TransactionsPage() {
  const user = await requireUser();
  const rows = await db.query.transactions.findMany({
    where: eq(schema.transactions.userId, user.id),
    orderBy: [desc(schema.transactions.createdAt)],
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">รายการเงินเข้า-ออก</h1>
        <p className="text-sm text-zinc-600">200 รายการล่าสุด</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-5 py-2">เวลา</th>
              <th className="px-5 py-2">ประเภท</th>
              <th className="px-5 py-2">ที่มา / หมายเหตุ</th>
              <th className="px-5 py-2">เลขอ้างอิง</th>
              <th className="px-5 py-2 text-right">จำนวน</th>
              <th className="px-5 py-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500">ยังไม่มีรายการ</td></tr>
            )}
            {rows.map((tx) => (
              <tr key={tx.id} className="border-t border-zinc-100">
                <td className="px-5 py-2 text-zinc-600 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString("th-TH")}</td>
                <td className="px-5 py-2">{KIND_LABELS[tx.kind] ?? tx.kind}</td>
                <td className="px-5 py-2 text-zinc-600">{tx.source ?? tx.note ?? "—"}</td>
                <td className="px-5 py-2 font-mono text-xs">{tx.externalRef ?? "—"}</td>
                <td className={`px-5 py-2 text-right font-mono ${tx.amountSatang < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {formatBaht(tx.amountSatang)}
                </td>
                <td className="px-5 py-2">{tx.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
