import { desc, eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/db";
import { newId } from "@/lib/utils";

const ALL_EVENTS = ["slip.verified", "slip.failed", "topup.credited"] as const;
type EventName = (typeof ALL_EVENTS)[number];

async function createWebhook(formData: FormData) {
  "use server";
  const user = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    redirect("/dashboard/webhooks?error=invalid_url");
  }
  const events = ALL_EVENTS.filter((ev) => formData.get(`event_${ev}`) === "on");
  if (events.length === 0) {
    redirect("/dashboard/webhooks?error=no_events");
  }
  const secret = "whsec_" + randomBytes(24).toString("base64url");
  const id = newId("wh");

  await db.insert(schema.customerWebhooks).values({
    id,
    userId: user.id,
    url,
    signingSecret: secret,
    enabled: true,
    events,
  });

  redirect(`/dashboard/webhooks?created=${encodeURIComponent(secret)}`);
}

async function toggleWebhook(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  await db
    .update(schema.customerWebhooks)
    .set({ enabled: next })
    .where(and(eq(schema.customerWebhooks.id, id), eq(schema.customerWebhooks.userId, user.id)));
  redirect("/dashboard/webhooks");
}

async function deleteWebhook(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db
    .delete(schema.customerWebhooks)
    .where(and(eq(schema.customerWebhooks.id, id), eq(schema.customerWebhooks.userId, user.id)));
  redirect("/dashboard/webhooks");
}

const ERROR_LABELS: Record<string, string> = {
  invalid_url: "URL ไม่ถูกต้อง — ต้องขึ้นต้นด้วย https:// หรือ http://",
  no_events: "ต้องเลือก event อย่างน้อย 1 รายการ",
};

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const hooks = await db.query.customerWebhooks.findMany({
    where: eq(schema.customerWebhooks.userId, user.id),
    orderBy: [desc(schema.customerWebhooks.createdAt)],
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Webhooks</h1>
        <p className="text-sm text-zinc-600">
          ลงทะเบียน URL ของคุณ เพื่อให้ SlipGate ยิงผลลัพธ์กลับไปทันทีที่มี event เกิดขึ้น
        </p>
      </div>

      {sp.created && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4">
          <p className="font-semibold text-emerald-800 mb-2">สร้าง Webhook สำเร็จ</p>
          <p className="text-sm text-emerald-700 mb-2">
            คัดลอก signing secret ตอนนี้เลย — เราจะไม่แสดงค่านี้อีก ใช้สำหรับตรวจสอบ HMAC-SHA256 ของ payload
          </p>
          <code className="block bg-white border border-emerald-300 rounded px-3 py-2 text-xs break-all">
            {sp.created}
          </code>
        </div>
      )}

      {sp.error && ERROR_LABELS[sp.error] && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {ERROR_LABELS[sp.error]}
        </div>
      )}

      <form action={createWebhook} className="card p-5 space-y-4">
        <div>
          <label className="label" htmlFor="url">URL ปลายทาง</label>
          <input
            id="url"
            name="url"
            type="url"
            className="input font-mono text-sm"
            placeholder="https://your-app.com/webhooks/slipgate"
            required
          />
        </div>
        <div>
          <span className="label">Events ที่ต้องการรับ</span>
          <div className="flex flex-wrap gap-3">
            {ALL_EVENTS.map((ev) => (
              <label
                key={ev}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  name={`event_${ev}`}
                  defaultChecked={ev === "slip.verified"}
                  className="h-4 w-4"
                />
                <code className="text-xs">{ev}</code>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary">เพิ่ม Webhook</button>
      </form>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-5 py-2">URL</th>
                <th className="px-5 py-2">Events</th>
                <th className="px-5 py-2">สถานะ</th>
                <th className="px-5 py-2">ส่งล่าสุด</th>
                <th className="px-5 py-2 text-right">ล้มเหลว</th>
                <th className="px-5 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {hooks.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500">ยังไม่มี webhook</td></tr>
              )}
              {hooks.map((h) => {
                const events = Array.isArray(h.events) ? (h.events as EventName[]) : [];
                return (
                  <tr key={h.id} className="border-t border-zinc-100 align-top">
                    <td className="px-5 py-3 font-mono text-xs break-all max-w-xs">{h.url}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {events.map((ev) => (
                          <span key={ev} className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-mono">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <form action={toggleWebhook} className="inline">
                        <input type="hidden" name="id" value={h.id} />
                        <input type="hidden" name="next" value={String(!h.enabled)} />
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            h.enabled
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${h.enabled ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          {h.enabled ? "เปิดใช้งาน" : "ปิดอยู่"}
                        </button>
                      </form>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 whitespace-nowrap">
                      {h.lastDeliveryAt ? (
                        <>
                          {new Date(h.lastDeliveryAt).toLocaleString("th-TH")}
                          {h.lastDeliveryStatus !== null && (
                            <span className="ml-1 text-xs text-zinc-500">({h.lastDeliveryStatus})</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {h.failureCount > 0 ? (
                        <span className="text-red-600">{h.failureCount}</span>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteWebhook} className="inline">
                        <input type="hidden" name="id" value={h.id} />
                        <button className="text-red-600 text-xs hover:underline">ลบ</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-900 mb-2">การตรวจสอบ signature</p>
        <p className="mb-2">
          ทุก request ที่ส่งจาก SlipGate จะมี header <code className="text-xs bg-zinc-100 px-1 rounded">X-SlipGate-Signature</code> เป็นค่า
          <code className="text-xs bg-zinc-100 px-1 rounded ml-1">HMAC-SHA256(signingSecret, rawBody)</code> เข้ารหัสแบบ hex
        </p>
        <p className="text-xs text-zinc-500">
          แนะนำให้ตอบกลับ HTTP 200 ภายใน 5 วินาที — หากล้มเหลวเราจะ retry แบบ exponential backoff สูงสุด 5 ครั้ง
        </p>
      </div>
    </div>
  );
}
