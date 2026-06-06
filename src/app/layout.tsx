import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SlipGate – ตรวจสลิป + รับเงิน TrueWallet & ธนาคาร ครบในที่เดียว",
  description:
    "ระบบตรวจสอบสลิปโอนเงิน, รับ Webhook ทรูมันนี่ Official, รับซองอั่งเปา, และเติม/ถอนเครดิตอัตโนมัติ สำหรับนักพัฒนาและร้านค้าออนไลน์",
  openGraph: {
    title: "SlipGate",
    description: "Slip verification + TrueMoney webhook + voucher redeem + credit ledger",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
