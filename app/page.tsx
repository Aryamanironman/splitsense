import Link from "next/link";
import { SeedButton } from "@/components/SeedButton";
import { SplitBar, SplitLegend } from "@/components/SplitBar";
import { StatusPill } from "@/components/StatusPill";
import { listDeals } from "@/lib/db";
import { formatMoney, timeAgo } from "@/lib/format";
import { paypalMode } from "@/lib/paypal";
import { computeSplit } from "@/lib/split";
import type { Collaborator } from "@/lib/types";

export const dynamic = "force-dynamic";

const EXAMPLE = {
  amountCents: 400000,
  taxPercent: 25,
  collaborators: [
    { id: "sam", name: "Sam", role: "Editor", email: "", percent: 30 },
    { id: "priya", name: "Priya", role: "Thumbnail artist", email: "", percent: 15 },
  ] as Collaborator[],
};

export default async function HomePage() {
  const deals = await listDeals();
  const mode = paypalMode();

  const splits = deals.map((deal) => ({
    deal,
    split: computeSplit(deal.amountCents, deal.taxPercent, deal.collaborators),
  }));
  const totalIn = deals.reduce((sum, d) => sum + d.amountCents, 0);
  const paidOut = splits
    .filter(({ deal }) => deal.status === "SPLIT")
    .reduce((sum, { split }) => sum + split.collaboratorTotalCents, 0);
  const taxReserved = splits
    .filter(({ deal }) => deal.status !== "AWAITING_PAYMENT")
    .reduce((sum, { split }) => sum + split.taxCents, 0);

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Creator payouts · PayPal</span>
            <h1>
              One payment. <em>Everyone paid.</em>
            </h1>
            <p className="hero-sub">
              A brand deal lands as a single PayPal payment. SplitSense reads the deal, works out who
              gets what, and pays your editor, artist and tax reserve in one confirmed batch.
            </p>
            <div className="hero-actions">
              <Link href="/deals/new" className="btn btn-accent">
                Split a payment
              </Link>
              <a href="#how" className="btn btn-ghost">
                See how it works
              </a>
            </div>
            <p className="hero-note">
              {mode === "live"
                ? "Connected to PayPal sandbox. Real capture and payout calls."
                : "Demo mode. Add PayPal sandbox credentials to see live IDs."}
            </p>
          </div>

          <div className="split-card">
            <div className="split-card-head">
              <div>
                <div className="split-card-title">Autumn campaign film</div>
                <div className="split-card-sub">Northwind Studio · paid once</div>
              </div>
              <div className="split-amount">$4,000</div>
            </div>
            <SplitBar input={EXAMPLE} />
            <SplitLegend input={EXAMPLE} />
            <p className="hero-note" style={{ marginTop: 14 }}>
              One captured payment, four owners, one confirmation.
            </p>
          </div>
        </div>

        <div className="container">
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Payments in</div>
              <div className="stat-value">{formatMoney(totalIn)}</div>
              <div className="stat-sub">across {deals.length} deals</div>
            </div>
            <div className="stat">
              <div className="stat-label">Paid to collaborators</div>
              <div className="stat-value">{formatMoney(paidOut)}</div>
              <div className="stat-sub">settled through PayPal</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tax reserved</div>
              <div className="stat-value">{formatMoney(taxReserved)}</div>
              <div className="stat-sub">kept, never split</div>
            </div>
            <div className="stat">
              <div className="stat-label">Your share kept</div>
              <div className="stat-value">
                {formatMoney(
                  splits
                    .filter(({ deal }) => deal.status !== "AWAITING_PAYMENT")
                    .reduce((sum, { split }) => sum + split.creatorCents, 0),
                )}
              </div>
              <div className="stat-sub">after collaborators and tax</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="deals">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="section-kicker">The deals</div>
              <h2 className="section-title">Every payment, already divided</h2>
              <p className="section-sub">
                Amounts are computed in cents from the percentages you agreed. Nothing waits in a
                spreadsheet.
              </p>
            </div>
            <Link href="/deals/new" className="btn btn-ghost btn-sm">
              New split
            </Link>
          </div>

          {deals.length === 0 ? (
            <div className="empty">
              <h3>No deals yet</h3>
              <p>Load the demo set to see funded, split and partial payouts.</p>
              <div style={{ marginTop: 16 }}>
                <SeedButton />
              </div>
            </div>
          ) : (
            <div className="deal-grid">
              {deals.map((deal) => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="deal-card">
                  <div className="deal-top">
                    <span className="payer">{deal.payer}</span>
                    <StatusPill status={deal.status} />
                  </div>
                  <h3 className="deal-title">{deal.title}</h3>
                  <SplitBar
                    input={{
                      amountCents: deal.amountCents,
                      taxPercent: deal.taxPercent,
                      collaborators: deal.collaborators,
                    }}
                    compact
                  />
                  <div className="deal-bottom">
                    <div>
                      <div className="deal-amount">{formatMoney(deal.amountCents)}</div>
                      <div className="deal-meta" style={{ textAlign: "left" }}>
                        {deal.collaborators.length} collaborator
                        {deal.collaborators.length === 1 ? "" : "s"} · {deal.taxPercent}% tax
                      </div>
                    </div>
                    <div className="deal-meta">
                      {deal.demo ? "demo · " : ""}
                      {timeAgo(deal.updatedAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="section-kicker">How it works</div>
              <h2 className="section-title">Read it once. Pay everyone once.</h2>
            </div>
          </div>
          <div className="steps">
            <div className="step">
              <span className="step-num">1</span>
              <h3 className="step-title">Describe the deal</h3>
              <p className="step-body">
                Write the percentages in plain language. The AI extracts names and shares; the
                server validates them and computes every amount in cents.
              </p>
            </div>
            <div className="step">
              <span className="step-num">2</span>
              <h3 className="step-title">The brand pays once</h3>
              <p className="step-body">
                PayPal captures the full deal amount. The money is real before anyone is paid out,
                and no collaborator waits on the brand.
              </p>
            </div>
            <div className="step">
              <span className="step-num">3</span>
              <h3 className="step-title">Confirm the split</h3>
              <p className="step-body">
                One Payouts batch pays every collaborator. Tax and your share stay in the account,
                and the AG Grid ledger reconciles the whole deal.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Reconciliation</h2>
              <span className="pill tone-teal">AG Grid Community</span>
            </div>
            <div className="panel-body">
              <p className="section-sub" style={{ marginTop: 0 }}>
                Each deal opens into a real ledger: sort by amount, filter by status, search payees,
                and export a CSV. The grid is the audit trail, not a screenshot of one.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
