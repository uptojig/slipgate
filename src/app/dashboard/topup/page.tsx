import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/credit/ledger";
import { db, schema } from "@/db";
import { formatBaht } from "@/lib/utils";
import { TopupForm } from "@/components/dashboard/topup-form";
import { Wallet, Sparkles, CreditCard } from "lucide-react";

const DEFAULT_FREE_QUOTA = 100;
const PRICE_PER_SLIP_SATANG = 20;

function currentCycleKey(): string {
  const now = new Date();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${m}`;
}

export default async function TopupPage() {
  const user = await requireUser();
  const [balance, quota] = await Promise.all([
    getBalance(user.id),
    db.query.userQuotas.findFirst({ where: eq(schema.userQuotas.userId, user.id) }),
  ]);

  const cycle = currentCycleKey();
  const freeRemaining =
    quota && quota.cycleKey === cycle ? quota.freeRemaining : DEFAULT_FREE_QUOTA;

  const adminPhone = process.env.NEXT_PUBLIC_ADMIN_TMN_PHONE ?? "";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">เติมเครดิต</h1>
        <p className="text-sm text-zinc-600">โอนผ่าน TrueMoney แล้วระบบเติมเครดิตให้อัตโนมัติ</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5 bg-brand-50 border-brand-100">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Wallet className="h-4 w-4" /> ยอดเครดิตปัจจุบัน
          </div>
          <div className="mt-2 text-2xl font-bold text-brand-700">{formatBaht(balance)}</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Sparkles className="h-4 w-4" /> สลิปฟรีเดือนนี้คงเหลือ
          </div>
          <div className="mt-2 text-2xl font-bold">
            {freeRemaining.toLocaleString("th-TH")} <span className="text-sm font-medium text-zinc-500">/ {DEFAULT_FREE_QUOTA}</span>
          </div>
        </div>
      </div>

      <TopupForm userId={user.id} adminPhone={adminPhone} />

      <div className="card p-5">
        <div className="flex items-center gap-2 font-semibold mb-3">
          <CreditCard className="h-4 w-4" /> ราคาและสิทธิ์การใช้งาน
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td className="py-2 text-zinc-600">ราคาตรวจสลิป</td>
              <td className="py-2 text-right font-medium">
                {formatBaht(PRICE_PER_SLIP_SATANG)} / สลิป
              </td>
            </tr>
            <tr>
              <td className="py-2 text-zinc-600">สลิปฟรีต่อเดือน</td>
              <td className="py-2 text-right font-medium">100 สลิป</td>
            </tr>
            <tr>
              <td className="py-2 text-zinc-600">รอบการรีเซ็ตสิทธิ์ฟรี</td>
              <td className="py-2 text-right font-medium">วันที่ 1 ของทุกเดือน</td>
            </tr>
            <tr>
              <td className="py-2 text-zinc-600">เครดิตหมดอายุ</td>
              <td className="py-2 text-right font-medium">ไม่มีวันหมดอายุ</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-500">
          ใช้เกินโควต้าฟรีจะเริ่มหักจากเครดิตที่เติมไว้ตามอัตราข้างต้น
        </p>
      </div>
    </div>
  );
}
