import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { formatBaht } from "@/lib/utils";
import { BarChart3, Activity, Coins, CalendarDays, Sparkles } from "lucide-react";

const DEFAULT_FREE_QUOTA = 100;

function currentCycleKey(): string {
  const now = new Date();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${m}`;
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export default async function UsagePage() {
  const user = await requireUser();

  const since30 = new Date();
  since30.setUTCHours(0, 0, 0, 0);
  since30.setUTCDate(since30.getUTCDate() - 29);

  const monthStart = startOfMonthUtc();

  const [daily, monthly, recent, quota] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${schema.usageEvents.createdAt}::date, 'YYYY-MM-DD')`,
        endpoint: schema.usageEvents.endpoint,
        units: sql<number>`coalesce(sum(${schema.usageEvents.units}), 0)`,
        charged: sql<number>`coalesce(sum(${schema.usageEvents.chargedSatang}), 0)`,
      })
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.userId, user.id),
          gte(schema.usageEvents.createdAt, since30),
        ),
      )
      .groupBy(sql`${schema.usageEvents.createdAt}::date`, schema.usageEvents.endpoint),
    db
      .select({
        calls: sql<number>`count(*)`,
        units: sql<number>`coalesce(sum(${schema.usageEvents.units}), 0)`,
        charged: sql<number>`coalesce(sum(${schema.usageEvents.chargedSatang}), 0)`,
      })
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.userId, user.id),
          gte(schema.usageEvents.createdAt, monthStart),
        ),
      ),
    db.query.usageEvents.findMany({
      where: eq(schema.usageEvents.userId, user.id),
      orderBy: [desc(schema.usageEvents.createdAt)],
      limit: 50,
    }),
    db.query.userQuotas.findFirst({ where: eq(schema.userQuotas.userId, user.id) }),
  ]);

  const monthTotals = monthly[0] ?? { calls: 0, units: 0, charged: 0 };
  const cycle = currentCycleKey();
  const freeRemaining =
    quota && quota.cycleKey === cycle ? quota.freeRemaining : DEFAULT_FREE_QUOTA;

  const dayBuckets = new Map<string, { total: number; perEndpoint: Map<string, number> }>();
  for (const key of lastNDays(30)) {
    dayBuckets.set(key, { total: 0, perEndpoint: new Map() });
  }
  for (const row of daily) {
    const bucket = dayBuckets.get(row.day);
    if (!bucket) continue;
    const units = Number(row.units);
    bucket.total += units;
    bucket.perEndpoint.set(row.endpoint, (bucket.perEndpoint.get(row.endpoint) ?? 0) + units);
  }
  const maxPerDay = Math.max(1, ...Array.from(dayBuckets.values()).map((b) => b.total));
  const daysSinceMonthStart = Math.max(
    1,
    Math.floor((Date.now() - monthStart.getTime()) / 86_400_000) + 1,
  );
  const avgPerDay = Math.round(Number(monthTotals.calls) / daysSinceMonthStart);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">การใช้งาน</h1>
        <p className="text-sm text-zinc-600">สรุปสถิติการเรียกใช้ API ใน 30 วันล่าสุด</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="เรียกใช้เดือนนี้" value={Number(monthTotals.calls).toLocaleString("th-TH")} />
        <StatCard icon={Coins} label="เครดิตที่ใช้เดือนนี้" value={formatBaht(Number(monthTotals.charged))} />
        <StatCard icon={CalendarDays} label="เฉลี่ยต่อวัน" value={`${avgPerDay.toLocaleString("th-TH")} ครั้ง`} />
        <StatCard icon={Sparkles} label="สลิปฟรีคงเหลือ" value={`${freeRemaining.toLocaleString("th-TH")} / ${DEFAULT_FREE_QUOTA}`} />
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 font-semibold mb-4">
          <BarChart3 className="h-4 w-4" /> การเรียกใช้รายวัน (30 วันล่าสุด)
        </div>
        <div className="flex items-end gap-1 h-48">
          {Array.from(dayBuckets.entries()).map(([day, bucket]) => {
            const heightPct = (bucket.total / maxPerDay) * 100;
            return (
              <div
                key={day}
                className="flex-1 flex flex-col items-stretch justify-end group"
                title={`${day}: ${bucket.total.toLocaleString("th-TH")} ครั้ง`}
              >
                <div
                  className="bg-brand-500 group-hover:bg-brand-600 rounded-sm transition-colors"
                  style={{ height: `${Math.max(heightPct, bucket.total > 0 ? 2 : 0)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-500 font-mono">
          <span>{Array.from(dayBuckets.keys())[0]}</span>
          <span>วันนี้</span>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-zinc-200 font-semibold">รายการเรียกใช้ล่าสุด</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-5 py-2">เวลา</th>
                <th className="px-5 py-2">Endpoint</th>
                <th className="px-5 py-2 text-right">Units</th>
                <th className="px-5 py-2 text-right">หักเครดิต</th>
                <th className="px-5 py-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-500">ยังไม่มีการใช้งาน</td></tr>
              )}
              {recent.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 text-zinc-600 whitespace-nowrap">{new Date(row.createdAt).toLocaleString("th-TH")}</td>
                  <td className="px-5 py-2 font-mono text-xs">{row.endpoint}{row.sandbox ? " (sandbox)" : ""}</td>
                  <td className="px-5 py-2 text-right">{row.units.toLocaleString("th-TH")}</td>
                  <td className="px-5 py-2 text-right font-mono">{formatBaht(row.chargedSatang)}</td>
                  <td className="px-5 py-2">
                    {row.success ? (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700">success</span>
                    ) : (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-red-50 text-red-700">{row.errorCode ?? "failed"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
