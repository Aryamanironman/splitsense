import Link from "next/link";
import { notFound } from "next/navigation";
import { DealActions } from "@/components/DealActions";
import { LedgerGrid, type LedgerRow } from "@/components/LedgerGrid";
import { SplitBar, SplitLegend } from "@/components/SplitBar";
import { StatusPill } from "@/components/StatusPill";
import { getDeal } from "@/lib/db";
import { formatMoney, timeAgo } from "@/lib/format";
import { paypalMode } from "@/lib/paypal";
import { refreshPayouts } from "@/lib/pipeline";
import { computeSplit } from "@/lib/split";
import type { Payout } from "@/lib/types";

export const dynamic = "force-dynamic";

function payoutStatus(payout?: Payout): string {
  if (!payout) return "Unpaid";
  switch (payout.status) {
    case "SUCCESS":
      return "Paid";
    case "PENDING":
      return "Pending";
    case "UNCLAIMED":
      return "Unclaimed";
    case "FAILED":
      return "Failed";
    default:
      return payout.status;
  }
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let deal = await getDeal(id);
  if (!deal) notFound();
  if (deal.status === "PARTIAL") {
    const refreshed = await refreshPayouts(id);
    if (refreshed) deal = refreshed;
  }
  const mode = paypalMode();

  const split = computeSplit(deal.amountCents, deal.taxPercent, deal.collaborators);
  const payoutsById = new Map(deal.payouts.map((p) => [p.id, p]));

  const rows: LedgerRow[] = split.rows.map((row) => {
    if (row.kind === "collaborator") {
      const payout = payoutsById.get(row.id);
      return {
        id: row.id,
        payee: row.name,
        role: row.role,
        kind: "Collaborator",
        percent: row.percent,
        amountCents: row.amountCents,
        status: payoutStatus(payout),
        reference: payout ? payout.itemId || payout.batchId || "—" : "—",
      };
    }
    if (row.kind === "tax") {
      return {
        id: "tax",
        payee: "Tax reserve",
        role: "Set aside",
        kind: "Tax",
        percent: row.percent,
        amountCents: row.amountCents,
        status: "Reserved",
        reference: "—",
      };
    }
    return {
      id: "creator",
      payee: "You",
      role: "Creator",
      kind: "Creator",
      percent: row.percent,
      amountCents: row.amountCents,
      status: "Retained",
      reference: "—",
    };
  });

  const batches = Array.from(new Set(deal.payouts.map((p) => p.batchId).filter(Boolean)));
  const paidCount = deal.payouts.filter((p) => p.status === "SUCCESS").length;

  return (
    <main className="detail">
      <div className="container">
        <Link className="crumb" href="/">
          ← All deals
        </Link>

        <div className="detail-head">
          <div className="detail-meta">
            <span className="payer">{deal.payer}</span>
            <StatusPill status={deal.status} />
            <span>{timeAgo(deal.createdAt)}</span>
            <span className="mono" style={{ fontSize: 11 }}>
              {deal.id}
            </span>
            {deal.demo ? <span className="pill tone-muted">Demo data</span> : null}
          </div>
          <h1 className="detail-title">{deal.title}</h1>
          {deal.brief ? <p className="section-sub">{deal.brief}</p> : null}
        </div>

        <div className="detail-grid">
          <div className="main-col">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">The split</h2>
                <span className="pill tone-teal">{deal.taxPercent}% tax reserve</span>
              </div>
              <div className="panel-body">
                <SplitBar
                  input={{
                    amountCents: deal.amountCents,
                    taxPercent: deal.taxPercent,
                    collaborators: deal.collaborators,
                  }}
                />
                <SplitLegend
                  input={{
                    amountCents: deal.amountCents,
                    taxPercent: deal.taxPercent,
                    collaborators: deal.collaborators,
                  }}
                />
                <p className="ledger-hint" style={{ padding: "12px 0 0" }}>
                  Computed in cents from the agreed percentages. The model never calculates an
                  amount.
                </p>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Ledger</h2>
                <span className="pill tone-teal">AG Grid</span>
              </div>
              <LedgerGrid rows={rows} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Activity</h2>
              </div>
              <div className="panel-body" style={{ paddingTop: 6 }}>
                <div className="event-list">
                  {deal.events.map((event) => (
                    <div className="event-row" key={event.id}>
                      <span className={`event-dot tone-${event.type === "failed" ? "red" : event.type === "funded" ? "green" : "muted"}`} />
                      <span>{event.message}</span>
                      <span className="event-time">{timeAgo(event.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="side-col">
            <section className="panel">
              <div className="panel-body">
                <div className="amount-big">{formatMoney(deal.amountCents)}</div>
                <div className="amount-caption">
                  {deal.status === "SPLIT"
                    ? `split to ${paidCount} collaborator${paidCount === 1 ? "" : "s"}`
                    : deal.status === "FUNDED"
                      ? "captured · ready to split"
                      : deal.status === "PARTIAL"
                        ? "some payouts need attention"
                        : "waiting for the brand to pay"}
                </div>
                <DealActions deal={deal} mode={mode} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">PayPal trail</h2>
                <span className={`pill ${deal.payment?.mode === "live" ? "tone-green" : "tone-muted"}`}>
                  {deal.payment?.mode || "none"}
                </span>
              </div>
              <div className="panel-body">
                <div className="kv">
                  <div className="kv-row">
                    <span className="kv-key">Payment order</span>
                    <span className="kv-val mono">{deal.payment?.orderId || "—"}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Capture</span>
                    <span className="kv-val mono">{deal.payment?.captureId || "—"}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Payout batches</span>
                    <span className="kv-val mono">{batches.length ? batches.join(", ") : "—"}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Payout items</span>
                    <span className="kv-val mono">
                      {deal.payouts.filter((p) => p.itemId).map((p) => p.itemId).join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Deal facts</h2>
              </div>
              <div className="panel-body">
                <div className="kv">
                  <div className="kv-row">
                    <span className="kv-key">Paying brand</span>
                    <span className="kv-val">{deal.payer}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Collaborators</span>
                    <span className="kv-val">{deal.collaborators.length}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Tax reserve</span>
                    <span className="kv-val">{deal.taxPercent}%</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Your share</span>
                    <span className="kv-val mono">{formatMoney(split.creatorCents)}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Created</span>
                    <span className="kv-val">{timeAgo(deal.createdAt)}</span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
