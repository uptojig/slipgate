import Link from "next/link";
import { redirect } from "next/navigation";
import { loginWithPassword, createSession } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await loginWithPassword(email, password);
  if (!user) return redirect(`/login?error=invalid`);
  await createSession(user.id);
  redirect("/dashboard");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="card w-full max-w-md p-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-6">
          <span className="inline-block h-6 w-6 rounded-md bg-brand-600" /> SlipGate
        </Link>
        <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
        <p className="text-sm text-zinc-600 mt-1">ยินดีต้อนรับกลับมา</p>

        {sp.error === "invalid" && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            อีเมลหรือรหัสผ่านไม่ถูกต้อง
          </div>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">อีเมล</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">รหัสผ่าน</label>
            <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">เข้าสู่ระบบ</button>
        </form>

        <p className="mt-4 text-sm text-center text-zinc-600">
          ยังไม่มีบัญชี? <Link href="/register" className="text-brand-600 font-medium">สมัครฟรี</Link>
        </p>
      </div>
    </main>
  );
}
