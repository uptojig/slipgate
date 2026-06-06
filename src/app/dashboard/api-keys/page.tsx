import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { newId, sha256 } from "@/lib/utils";

async function createKey(formData: FormData) {
  "use server";
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "Untitled key";
  const isSandbox = formData.get("sandbox") === "on" || formData.get("sandbox") === "1";
  const prefix = isSandbox ? "sk_test_" : "sk_";
  const raw = prefix + randomBytes(24).toString("base64url");
  const id = newId("ak");

  await db.insert(schema.apiKeys).values({
    id,
    userId: user.id,
    name,
    keyPrefix: raw.slice(0, 12),
    keyHash: sha256(raw),
    isSandbox,
  });

  redirect(`/dashboard/api-keys?created=${encodeURIComponent(raw)}`);
}

async function revokeKey(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db
    .update(schema.apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(schema.apiKeys.id, id));
  redirect("/dashboard/api-keys");
}

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const keys = await db.query.apiKeys.findMany({
    where: eq(schema.apiKeys.userId, user.id),
    orderBy: [desc(schema.apiKeys.createdAt)],
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-zinc-600">ใช้ key เพื่อเรียก SlipGate API จากเว็บคุณ</p>
        </div>
      </div>

      {sp.created && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4">
          <p className="font-semibold text-emerald-800 mb-2">สร้าง API Key สำเร็จ</p>
          <p className="text-sm text-emerald-700 mb-2">
            คัดลอกเก็บไว้ตอนนี้เลย — เราจะไม่แสดงค่านี้อีก
          </p>
          <code className="block bg-white border border-emerald-300 rounded px-3 py-2 text-xs break-all">{sp.created}</code>
        </div>
      )}

      <form action={createKey} className="card p-5 flex flex-col gap-3">
        <div className="flex gap-3">
          <input name="name" placeholder="ชื่อ key เช่น Production website" className="input flex-1" required />
          <button type="submit" className="btn-primary">สร้าง Key ใหม่</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="sandbox" value="1" className="rounded border-zinc-300" />
          <span>Sandbox key (sk_test_*) — ไม่หักเครดิต ใช้ทดสอบ integration</span>
        </label>
      </form>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-5 py-2">ชื่อ</th>
              <th className="px-5 py-2">Prefix</th>
              <th className="px-5 py-2">Type</th>
              <th className="px-5 py-2">ใช้ล่าสุด</th>
              <th className="px-5 py-2">สร้างเมื่อ</th>
              <th className="px-5 py-2">สถานะ</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">ยังไม่มี API key</td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-zinc-100">
                <td className="px-5 py-2 font-medium">{k.name}</td>
                <td className="px-5 py-2 font-mono text-xs">{k.keyPrefix}…</td>
                <td className="px-5 py-2">
                  {k.isSandbox ? (
                    <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      sandbox
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                      live
                    </span>
                  )}
                </td>
                <td className="px-5 py-2 text-zinc-600">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("th-TH") : "—"}</td>
                <td className="px-5 py-2 text-zinc-600">{new Date(k.createdAt).toLocaleDateString("th-TH")}</td>
                <td className="px-5 py-2">{k.revokedAt ? <span className="text-red-700">revoked</span> : <span className="text-emerald-700">active</span>}</td>
                <td className="px-5 py-2 text-right">
                  {!k.revokedAt && (
                    <form action={revokeKey} className="inline">
                      <input type="hidden" name="id" value={k.id} />
                      <button className="text-red-600 text-xs hover:underline">เพิกถอน</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
