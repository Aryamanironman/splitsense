# SplitSense

**One payment. Everyone paid.**

A creator closes a brand deal and the money lands as a single PayPal payment. SplitSense reads the
deal from plain language, splits it across collaborators and a tax reserve, and pays everyone in one
confirmed PayPal Payouts batch. The AG Grid ledger reconciles the whole deal.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

**Live demo:** [ADD AFTER DEPLOY] · **Repo:** [ADD AFTER PUSH]

## What it does

1. **Describe the deal.** “Sam gets 30%, Priya gets 15%, set aside 25% for tax.” The AI extracts
   names, roles and percentages. The server validates them and computes every amount in cents.
2. **The brand pays once.** PayPal Orders v2 (`intent=CAPTURE`) captures the full amount. The money
   is real before anyone is paid out.
3. **Confirm the split.** One PayPal Payouts batch pays every collaborator. Tax and the creator’s
   share stay in the account. A second confirmation is required before money moves.

Payout batches settle asynchronously. The app refreshes item statuses from PayPal and distinguishes
`SUCCESS`, `PENDING`, `UNCLAIMED` and `FAILED`; a recipient who has no PayPal account shows as
unclaimed rather than pretending to be paid.

## PayPal + AI

- **PayPal Orders v2** — creates the payment request and captures the brand payment.
- **PayPal Payouts v1** — a single batch with one item per collaborator; returns batch and item IDs.
- **PayPal sandbox** — the live demo runs against sandbox accounts and REST hosts.
- **Groq `openai/gpt-oss-120b`** — reads the deal brief and returns strict JSON: title, payer,
  amount, tax percent, and collaborator names/roles/percentages. It never calculates money and never
  triggers a payment.

## AG Grid

The deal ledger is a real AG Grid Community grid, not a static table:

- sort by amount or payee
- filter per column, including payout status
- quick search across the ledger
- CSV export
- live totals above the grid

It is the audit trail for every share: collaborator, tax reserve and creator.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3200
```

The store starts empty and seeds four demo deals (funded, split, awaiting payment, partial).
No credentials are needed to explore; without PayPal keys the app runs in clearly labelled demo
mode.

## PayPal sandbox

```bash
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox
PUBLIC_BASE_URL=http://localhost:3200
```

Create a sandbox app at [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox).
Payouts are sent by email, so each collaborator email must exist as a sandbox personal account for a
`SUCCESS`; an unregistered email returns `UNCLAIMED`.

## AI

Any OpenAI-compatible endpoint works:

```bash
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=...
AI_MODEL=openai/gpt-oss-120b
```

If the model is unavailable, a deterministic rule parser handles simple sentences and the UI labels
the source. Amounts are always computed server-side.

## Tests

```bash
npm test        # 22 tests: split math, validation, AI fallback, PayPal mock, full pipeline
npm run build
```

## Layout

```
app/                 pages and API routes
components/          SplitBar, LedgerGrid (AG Grid), DealActions, NewDealForm
lib/split.ts         deterministic money split
lib/ai.ts            brief parsing (Groq + rules fallback)
lib/paypal.ts        Orders v2 capture and Payouts
lib/pipeline.ts      state machine and payout refresh
lib/db.ts            JSON store with per-instance demo seeding
```

## Limitations

- This is a hackathon prototype, not a payroll or tax service. Tax is a reserved share, not a filing.
- On Vercel the JSON store lives in `/tmp` and is per-instance; demo data re-seeds automatically.
- Payouts to unregistered emails stay `UNCLAIMED` until the recipient claims or signs up.
- No authentication or multi-tenancy.

## License

MIT — see [LICENSE](LICENSE).
