import { requireUser } from "@/lib/auth";
import { TmnToolsPanel } from "@/components/dashboard/tmn-tools";

export default async function TmnToolsPage() {
  await requireUser();

  // Show which official service tokens are configured (just presence, not value)
  const configured = {
    p2pValidate: Boolean(process.env.TMN_P2P_VALIDATE_TOKEN),
    lastReceive: Boolean(process.env.TMN_LAST_RECEIVE_TOKEN),
    balance: Boolean(process.env.TMN_BALANCE_TOKEN),
    transferLink: Boolean(process.env.TMN_TRANSFER_LINK_TOKEN),
    qrInfo: Boolean(process.env.TMN_QR_INFO_TOKEN),
    webhook: Boolean(process.env.TMN_WEBHOOK_JWT_SECRET),
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">TrueMoney Service Tools</h1>
        <p className="text-sm text-zinc-600">
          ทุก endpoint ของ <code className="text-xs bg-zinc-100 px-1 rounded">apis.truemoneyservices.com</code> ในที่เดียว
        </p>
      </div>
      <TmnToolsPanel configured={configured} />
    </div>
  );
}
