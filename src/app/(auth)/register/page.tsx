import Link from "next/link";
import { redirect } from "next/navigation";
import { registerUser, createSession } from "@/lib/auth";

async function registerAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || undefined;

  if (password.length < 8) return redirect("/register?error=short");
  try {
    const userId = await registerUser(email, password, name);
    await createSession(userId);
  } catch (e) {
    if ((e as Error).message === "EMAIL_TAKEN") return redirect("/register?error=taken");
    return redirect("/register?error=server");
  }
  redirect("/dashboard");
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const errorMsg: Record<string, string> = {
    short: "รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร",
    taken: "อีเมลนี้ถูกใช้แล้ว",
    server: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง",
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="card w-full max-w-md p-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-6">
          <span className="inline-block h-6 w-6 rounded-md bg-brand-600" /> SlipGate
        </Link>
        <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
        <p className="text-sm text-zinc-600 mt-1">เริ่มต้นใช้งานฟรี ไม่ต้องผูกบัตร</p>

        {sp.error && errorMsg[sp.error] && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errorMsg[sp.error]}
          </div>
        )}

        <form action={registerAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">ชื่อ (ไม่บังคับ)</label>
            <input className="input" id="name" name="name" type="text" autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">อีเมล</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">รหัสผ่าน</label>
            <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            <p className="text-xs text-zinc-500 mt-1">อย่างน้อย 8 ตัวอักษร</p>
          </div>
          <button type="submit" className="btn-primary w-full py-2.5">สมัครสมาชิก</button>
        </form>

        <p className="mt-4 text-sm text-center text-zinc-600">
          มีบัญชีอยู่แล้ว? <Link href="/login" className="text-brand-600 font-medium">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </main>
  );
}
