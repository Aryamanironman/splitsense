"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { computeSplit } from "@/lib/split";
import type { Deal } from "@/lib/types";

type Busy = "fund" | "split" | "refresh" | null;

export function DealActions({ deal, mode }: { deal: Deal; mode: "live" | "mock" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [approveUrl, setApproveUrl] = useState(deal.payment?.approveUrl);

  const split = useMemo(
    () => computeSplit(deal.amountCents, deal.taxPercent, deal.collaborators),
    [deal.amountCents, deal.taxPercent, deal.collaborators],
  );
  const payoutTotal = split.collaboratorTotalCents;

  const canFund = deal.status === "AWAITING_PAYMENT";
  const hasFailed = deal.payouts.some((p) => p.status === "FAILED");
  const canSplit = deal.status === "FUNDED" || (deal.status === "PARTIAL" && hasFailed);
  const waiting = deal.status === "PARTIAL" && !hasFailed;
  const paid = deal.status === "SPLIT";

  async function post(path: string, body: unknown, key: Busy) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        approveUrl?: string;
        needsApproval?: boolean;
        ok?: boolean;
        message?: string;
      };
      if (json.approveUrl) setApproveUrl(json.approveUrl);
      if (json.needsApproval) {
        setNotice("Approve the payment in PayPal, then click “I’ve paid — capture”.");
        return;
      }
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setNotice(json.message || "Updated.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="actions">
      {canFund && (
        <>
          {mode === "live" && approveUrl ? (
            <a className="btn btn-accent btn-wide" href={approveUrl} target="_blank" rel="noreferrer">
              Approve payment in PayPal ↗
            </a>
          ) : null}
          <button
            type="button"
            className={`btn ${mode === "live" && approveUrl ? "btn-ghost" : "btn-accent"} btn-wide`}
            disabled={busy !== null}
            onClick={() => post(`/api/deals/${deal.id}/fund`, {}, "fund")}
          >
            {busy === "fund" ? <span className="spinner" /> : null}
            {mode === "live" && approveUrl
              ? "I’ve paid — capture"
              : mode === "live"
                ? "Start PayPal payment"
                : "Simulate payment"}
          </button>
          <p className="action-note">
            The full payment is captured once. Splitting happens only after you confirm.
          </p>
        </>
      )}

      {canSplit && (
        <div className="confirm-box">
          <p className="confirm-title">
            {deal.status === "PARTIAL" ? "Some payouts need attention" : "Confirm the split"}
          </p>
          <p className="action-note" style={{ textAlign: "left" }}>
            {formatMoney(payoutTotal)} goes to collaborators now.{" "}
            {formatMoney(split.taxCents)} tax and {formatMoney(split.creatorCents)} creator share stay
            in the account.
          </p>
          <label className="check-line">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>
              I checked every percentage and authorize the PayPal payouts. Unpaid or failed shares will
              be retried; pending shares will not be sent twice.
            </span>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={!confirm || busy !== null}
            onClick={() => post(`/api/deals/${deal.id}/split`, { confirm: true }, "split")}
          >
            {busy === "split" ? <span className="spinner" /> : null}
            {deal.status === "PARTIAL" ? "Retry unpaid shares" : `Confirm & split ${formatMoney(payoutTotal)}`}
          </button>
        </div>
      )}

      {waiting && (
        <div className="notice notice-warn">
          Some payouts are still pending or unclaimed. PayPal is holding them until the recipient
          claims. Refresh after they do.
        </div>
      )}

      {deal.status === "PARTIAL" && (
        <button
          type="button"
          className="btn-link"
          disabled={busy !== null}
          onClick={() => post(`/api/deals/${deal.id}/refresh`, {}, "refresh")}
        >
          {busy === "refresh" ? "Checking PayPal…" : "Refresh payout status"}
        </button>
      )}

      {paid && (
        <div className="notice notice-ok">
          Paid {deal.payouts.filter((p) => p.status === "SUCCESS").length} collaborator
          {deal.payouts.filter((p) => p.status === "SUCCESS").length === 1 ? "" : "s"} through PayPal.
          Tax and your share stayed in the account.
        </div>
      )}

      {error ? <div className="notice notice-error">{error}</div> : null}
      {notice ? <div className="notice notice-warn">{notice}</div> : null}

      {mode === "mock" ? (
        <p className="action-note">
          Demo mode: payment and payout IDs are simulated. Add PayPal sandbox credentials in{" "}
          <span className="mono">.env.local</span> for live calls.
        </p>
      ) : null}
    </div>
  );
}
