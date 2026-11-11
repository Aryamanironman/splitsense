# Devpost submission copy — SplitSense

**Tagline:** One payment, split correctly.

**Repo:** https://github.com/Aryamanironman/splitsense
**Demo:** https://splitsense-rho.vercel.app
**Video:** [ADD YOUTUBE URL]

---

## Inspiration

A creator closes a brand deal and the money arrives as one PayPal payment. But it was never all
theirs. An editor, a thumbnail artist and the tax office each own a slice. Today that means a
spreadsheet at 1am, five manual transfers, and a ledger nobody trusts.

We wanted the payment to split itself, with the percentages agreed once and every dollar accounted
for.

## What it does

SplitSense turns one creator payment into a confirmed, auditable split.

1. **Describe the deal in plain language.** “Sam gets 30%, Priya gets 15%, set aside 20% for tax.”
   The AI extracts names, roles and percentages into strict JSON. The server validates the rules
   and computes every amount in cents; the model never calculates money.
2. **The brand pays once.** PayPal Orders v2 (`intent=CAPTURE`) captures the full amount. The money
   is real before anyone is paid out.
3. **Confirm the split.** One PayPal Payouts batch sends each collaborator’s share. Tax and the
   creator’s share stay in the account. The release needs an explicit second confirmation.
4. **Reconcile in AG Grid.** Every share appears in a live ledger: sort by amount, filter by status,
   search payees, export CSV. Payout batches settle asynchronously, and the app refreshes item
   statuses from PayPal (`SUCCESS`, `PENDING`, `UNCLAIMED`, `FAILED`) instead of pretending
   everything is paid.

## How we built it

- **PayPal Orders v2** for the payment request and capture, and **PayPal Payouts v1** for a
  multi-item batch with one entry per collaborator.
- **PayPal sandbox** end to end: order, capture, payout batch, item statuses.
- **Groq** running **`openai/gpt-oss-120b`** as the deal parser, returning validated JSON.
- **AG Grid Community** for the reconciliation ledger.
- **Next.js 15 / React 19 / TypeScript**, a JSON store with per-instance demo seeding, and
  **Vitest** for split math, validation, AI fallback, the PayPal mock and the full pipeline.

## Sponsor tool: AG Grid

AG Grid Community is the product’s audit trail, not a decorative table:

- sortable columns (amount, payee, status)
- per-column filters and a quick search across the ledger
- pinned payee column, resizable columns
- CSV export of the current view
- currency and percentage formatting per cell

The ledger shows collaborators, the tax reserve and the creator share in one place, so the split can
be checked after the money moves.

## Challenges

- Keeping the AI advisory. It extracts percentages, but every amount is deterministic server-side;
  a percentage that over-allocates the payment is rejected before a PayPal order exists.
- Asynchronous payouts. A batch returns `PENDING`; recipients without a PayPal account stay
  `UNCLAIMED`. We learned to refresh the batch and show the real state rather than flatten it.
- Rounding. Splitting cents exactly means giving the remainder to the creator, never losing a cent.

## Accomplishments

- A real sandbox run: payment order, capture, multi-item Payouts batch, and item-level status
  refresh, with IDs shown in the UI.
- AI extraction that produces editable fields, not a black box.
- A ledger judges can actually inspect and export.
- 22 automated tests and a clean production build.

## What we learned

- The model is good at reading intent and bad at arithmetic; separating those jobs made the product
  simpler and safer.
- Payout states are part of the product. “Sent” and “settled” are different, and users need to see
  which one happened.

## What’s next

- A second sandbox recipient for a fully claimed demo.
- Per-collaborator invoices and a tax export.
- Persist the ledger in a real database and add authentication.
- A collaborator view where each person sees only their own share.

## Built with

`paypal-orders-v2` · `paypal-payouts` · `paypal-sandbox` · `groq` · `gpt-oss-120b` · `ag-grid` ·
`nextjs` · `react` · `typescript` · `vitest`

## AI tools used

- **Groq `openai/gpt-oss-120b`** — parses the deal brief into structured split rules.
- **Claude Code** — implementation, tests, video and documentation.
- A labelled rule-based fallback parser runs when no model key is configured.

## Sponsor tools used

**AG Grid Community** — the split ledger: sorting, filtering, search, pinned payee column and CSV
export. No other sponsor tool was used.
