import Link from "next/link";
import { NewDealForm } from "@/components/NewDealForm";
import { paypalMode } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export default function NewDealPage() {
  const mode = paypalMode();
  return (
    <main className="detail">
      <div className="container" style={{ maxWidth: 980 }}>
        <Link className="crumb" href="/">
          ← All deals
        </Link>
        <div className="detail-head">
          <h1 className="detail-title">Split a payment</h1>
          <p className="section-sub">
            Describe the deal once. SplitSense reads the shares, validates them, and creates a PayPal
            payment request for the brand.
          </p>
        </div>
        <NewDealForm />
        <p className="action-note" style={{ textAlign: "left", marginTop: 16 }}>
          {mode === "live"
            ? "PayPal sandbox is connected. After creating the deal you will approve the payment as the buyer, then confirm the split."
            : "Demo mode: no PayPal credentials, so payment and payout IDs are simulated. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to run live sandbox calls."}
        </p>
      </div>
    </main>
  );
}
