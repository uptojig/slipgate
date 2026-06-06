import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
};

const DEFAULT_NAV: NavItem[] = [
  { href: "/#features", label: "ฟีเจอร์" },
  { href: "/#pricing", label: "ราคา" },
  { href: "/docs", label: "เอกสาร API" },
];

export function Header({ nav = DEFAULT_NAV }: { nav?: NavItem[] }) {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur sticky top-0 z-30">
      <div className="container-page flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-block h-6 w-6 rounded-md bg-brand-600" />
          SlipGate
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-600">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-zinc-900">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            เข้าสู่ระบบ
          </Link>
          <Link href="/register" className="btn-primary">
            เริ่มใช้ฟรี
          </Link>
        </div>
      </div>
    </header>
  );
}
