import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, destroySession } from "@/lib/auth";
import { getBalance } from "@/lib/credit/ledger";
import { formatBaht } from "@/lib/utils";
import {
  LayoutDashboard,
  KeyRound,
  ScanLine,
  Gift,
  ArrowDownToLine,
  ArrowLeftRight,
  Webhook,
  CreditCard,
  BarChart3,
  Send,
  LogOut,
} from "lucide-react";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/login");
}

const NAV = [
  { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard },
  { href: "/dashboard/topup", label: "เติมเครดิต", icon: CreditCard },
  { href: "/dashboard/usage", label: "การใช้งาน", icon: BarChart3 },
  { href: "/dashboard/slip", label: "ตรวจสลิป", icon: ScanLine },
  { href: "/dashboard/voucher", label: "ซองอั่งเปา", icon: Gift },
  { href: "/dashboard/tmn-tools", label: "TMN Tools", icon: Webhook },
  { href: "/dashboard/webhooks", label: "Customer Webhooks", icon: Send },
  { href: "/dashboard/transactions", label: "รายการเงิน", icon: ArrowLeftRight },
  { href: "/dashboard/withdraw", label: "ถอนเงิน", icon: ArrowDownToLine },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const balance = await getBalance(user.id);

  return (
    <div className="min-h-screen flex bg-zinc-50">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg px-5 h-14 border-b border-zinc-200">
          <span className="inline-block h-6 w-6 rounded-md bg-brand-600" /> SlipGate
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="border-t border-zinc-200 p-3">
          <button type="submit" className="btn-ghost w-full justify-start">
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </button>
        </form>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-5">
          <div className="text-sm text-zinc-600">{user.name ?? user.email}</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">ยอดเครดิต</span>
            <span className="font-semibold text-brand-700">{formatBaht(balance)}</span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
