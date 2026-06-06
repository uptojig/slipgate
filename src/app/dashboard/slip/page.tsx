import { requireUser } from "@/lib/auth";
import { SlipUploader } from "@/components/dashboard/slip-uploader";

export default async function SlipPage() {
  await requireUser();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ตรวจสอบสลิปโอนเงิน</h1>
        <p className="text-sm text-zinc-600">
          อัปโหลดสลิปธนาคารหรือ TrueWallet — ระบบจะอ่าน QR + OCR และตรวจสอบความถูกต้องอัตโนมัติ
        </p>
      </div>
      <SlipUploader />
      <div className="card p-5 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-900 mb-2">รองรับ</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>สลิปธนาคารไทยทุกธนาคาร (BBL, KBANK, SCB, KTB, TTB, BAY, GSB, KKP, CIMBT, UOBT ฯลฯ)</li>
          <li>สลิปจากแอป TrueMoney Wallet</li>
          <li>สลิปจาก PromptPay (ตรวจ QR แบบ slip verify)</li>
        </ul>
      </div>
    </div>
  );
}
