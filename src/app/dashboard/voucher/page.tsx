import { requireUser } from "@/lib/auth";
import { VoucherForm } from "@/components/dashboard/voucher-form";

export default async function VoucherPage() {
  await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">รับซองอั่งเปา TrueMoney</h1>
        <p className="text-sm text-zinc-600">
          วางลิงก์ <code className="text-xs bg-zinc-100 px-1 rounded">gift.truemoney.com/...</code>
          หรือโค้ดอั่งเปา แล้วระบบจะเติมเข้ากระเป๋าให้อัตโนมัติ
        </p>
      </div>
      <VoucherForm />
      <div className="card p-5 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-900 mb-2">หมายเหตุ</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>เบอร์ที่ใช้รับซองต้องเป็นเบอร์ที่มีบัญชี TrueMoney Wallet</li>
          <li>ซองหนึ่งใบรับได้แค่ครั้งเดียว ระบบจะตรวจสอบให้</li>
          <li>เครดิตจะเข้าทันทีหากรับซองสำเร็จ</li>
        </ul>
      </div>
    </div>
  );
}
