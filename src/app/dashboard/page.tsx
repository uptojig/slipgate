import { and, desc, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getBalance } from "@/lib/credit/ledger";
import { db, schema } from "@/db";
import { formatBaht } from "@/lib/utils";
import { Wallet, ScanLine, Gift, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { SyncButton } from "@/components/dashboard/sync-button";

export default async function DashboardHome() {
  const user = await requireUser();
  const balance = await getBalance(user.id);

  const [topupTotal, incomingTotal, voucherTotal] = await Promise.all([
    sumKind(user.id, "tmn_topup"),
    sumKind(user.id, "tmn_incoming"),
    sumKind(user.id, "tmn_voucher"),
  ]);

  const recent = await db.query.transactions.findMany({
    where: eq(schema.transactions.userId, user.id),
    orderBy: [desc(schema.transactions.createdAt)],
    limit: 8,
  });

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/webhook/truemoney?u=${user.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ภาพรวม</h1>
          <p className="text-sm text-zinc-600">สวัสดี {user.name ?? user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/slip" className="btn-secondary"><ScanLine className="h-4 w-4" /> ตรวจสลิป</Link>
          <Link href="/dashboard/voucher" className="btn-primary"><Gift className="h-4 w-4" /> รับซองอั่งเปา</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="ยอดเครดิตปัจจุบัน" value={formatBaht(balance)} accent />
        <StatCard icon={ArrowLeftRight} label="เติมเงินจาก TrueWallet" value={formatBaht(topupTotal)} />
        <StatCard icon={ScanLine} label="โอนเข้า TrueWallet" value={formatBaht(incomingTotal)} />
        <StatCard icon={Gift} label="ซองอั่งเปา" value={formatBaht(voucherTotal)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Webhook URL ของคุณ</h2>
          <p className="text-sm text-zinc-600 mb-3">
            เปิดแอปทรูมันนี่ → ทรูมันนี่ → แจ้งรับเงิน/เติมเงิน → วาง URL นี้
          </p>
          <code className="block bg-zinc-100 px-3 py-2 rounded-md text-xs break-all">{webhookUrl}</code>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Sync แบบ Pull</h2>
          <p className="text-sm text-zinc-600 mb-3">
            ดึงรายการรับเงินล่าสุดจาก TMN เมื่อ webhook ขาด (ต้องตั้ง <code className="text-xs bg-zinc-100 px-1 rounded">TMN_LAST_RECEIVE_TOKEN</code>)
          </p>
          <SyncButton />
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-zinc-200 font-semibold">รายการล่าสุด</div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-5 py-2">เวลา</th>
              <th className="px-5 py-2">ประเภท</th>
              <th className="px-5 py-2">ที่มา</th>
              <th className="px-5 py-2 text-right">จำนวน</th>
              <th className="px-5 py-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">ยังไม่มีรายการ</td></tr>
            )}
            {recent.map((tx) => (
              <tr key={tx.id} className="border-t border-zinc-100">
                <td className="px-5 py-2 text-zinc-600">{new Date(tx.createdAt).toLocaleString("th-TH")}</td>
                <td className="px-5 py-2">{KIND_LABELS[tx.kind] ?? tx.kind}</td>
                <td className="px-5 py-2 text-zinc-600">{tx.source ?? "—"}</td>
                <td className="px-5 py-2 text-right font-mono">{formatBaht(tx.amountSatang)}</td>
                <td className="px-5 py-2"><StatusPill status={tx.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function sumKind(userId: string, kind: typeof schema.txKindEnum.enumValues[number]) {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.transactions.amountSatang}), 0)` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.kind, kind),
        eq(schema.transactions.status, "success"),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

const KIND_LABELS: Record<string, string> = {
  tmn_incoming: "โอนเข้า TrueWallet",
  tmn_topup: "เติมเงินผ่านธนาคาร",
  tmn_voucher: "ซองอั่งเปา",
  bank_slip: "สลิปธนาคาร",
  withdraw: "ถอน",
  adjust: "ปรับยอด",
};

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card p-5 ${accent ? "bg-brand-50 border-brand-100" : ""}`}>
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${accent ? "text-brand-700" : ""}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
    reversed: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${colors[status] ?? "bg-zinc-100"}`}>
      {status}
    </span>
  );
}
