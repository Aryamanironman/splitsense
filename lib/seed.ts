import type { Deal, DealEvent, Payout } from "./types";

function ev(type: DealEvent["type"], at: string, message: string): DealEvent {
  return { id: `${type}-${at}-${Math.random().toString(36).slice(2, 7)}`, at, type, message };
}

const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function payout(id: string, name: string, email: string, amountCents: number, at: string, status = "SUCCESS"): Payout {
  return {
    id,
    name,
    email,
    amountCents,
    batchId: `MOCK-BATCH-${id.toUpperCase()}`,
    itemId: `MOCK-ITEM-${id.toUpperCase()}`,
    status,
    at,
  };
}

export function seedDeals(): Deal[] {
  return [
    {
      id: "deal_demo_split",
      title: "Autumn campaign film",
      brief: "A brand deal paid by Northwind Studio. Sam edited, Priya made the thumbnails, 25% set aside for tax.",
      payer: "Northwind Studio",
      amountCents: 400000,
      currency: "USD",
      taxPercent: 25,
      collaborators: [
        { id: "col_sam", name: "Sam", email: "sam@example.com", role: "Editor", percent: 30 },
        { id: "col_priya", name: "Priya", email: "priya@example.com", role: "Thumbnail artist", percent: 15 },
      ],
      status: "SPLIT",
      payment: {
        mode: "mock",
        orderId: "MOCK-ORDER-SPLIT",
        captureId: "MOCK-CAPTURE-SPLIT",
        fundedAt: ago(4300),
      },
      payouts: [
        payout("col_sam", "Sam", "sam@example.com", 120000, ago(4200)),
        payout("col_priya", "Priya", "priya@example.com", 60000, ago(4200)),
      ],
      demo: true,
      createdAt: ago(4400),
      updatedAt: ago(4200),
      events: [
        ev("created", ago(4400), "Deal created for Northwind Studio"),
        ev("order_created", ago(4399), "Payment order created (demo)"),
        ev("funded", ago(4300), "Payment captured (demo)"),
        ev("split", ago(4200), "Split paid: Sam and Priya; tax and creator share retained"),
      ],
    },
    {
      id: "deal_demo_funded",
      title: "Podcast season sponsor",
      brief: "Sponsored season from Lumen Audio. Sam edits, Noor designs the cover art, 20% tax.",
      payer: "Lumen Audio",
      amountCents: 250000,
      currency: "USD",
      taxPercent: 20,
      collaborators: [
        { id: "col_sam", name: "Sam", email: "sam@example.com", role: "Editor", percent: 25 },
        { id: "col_noor", name: "Noor", email: "noor@example.com", role: "Cover artist", percent: 10 },
      ],
      status: "FUNDED",
      payment: {
        mode: "mock",
        orderId: "MOCK-ORDER-FUNDED",
        captureId: "MOCK-CAPTURE-FUNDED",
        fundedAt: ago(210),
      },
      payouts: [],
      demo: true,
      createdAt: ago(260),
      updatedAt: ago(210),
      events: [
        ev("created", ago(260), "Deal created for Lumen Audio"),
        ev("order_created", ago(259), "Payment order created (demo)"),
        ev("funded", ago(210), "Payment captured (demo)"),
      ],
    },
    {
      id: "deal_demo_awaiting",
      title: "Product launch shorts",
      brief: "Three launch shorts for Kite Labs. Sam gets 30%, 25% tax.",
      payer: "Kite Labs",
      amountCents: 180000,
      currency: "USD",
      taxPercent: 25,
      collaborators: [
        { id: "col_sam", name: "Sam", email: "sam@example.com", role: "Editor", percent: 30 },
      ],
      status: "AWAITING_PAYMENT",
      payment: { mode: "mock", orderId: "MOCK-ORDER-AWAIT", approveUrl: "/deals/deal_demo_awaiting" },
      payouts: [],
      demo: true,
      createdAt: ago(40),
      updatedAt: ago(40),
      events: [
        ev("created", ago(40), "Deal created for Kite Labs"),
        ev("order_created", ago(40), "Payment order created (demo), waiting for buyer approval"),
      ],
    },
    {
      id: "deal_demo_partial",
      title: "Newsletter illustration set",
      brief: "Six illustrations for The Weekly Ledger. Lena gets 20%, 25% tax.",
      payer: "The Weekly Ledger",
      amountCents: 90000,
      currency: "USD",
      taxPercent: 25,
      collaborators: [
        { id: "col_lena", name: "Lena", email: "lena@example.com", role: "Illustrator", percent: 20 },
      ],
      status: "PARTIAL",
      payment: { mode: "mock", orderId: "MOCK-ORDER-PARTIAL", captureId: "MOCK-CAPTURE-PARTIAL", fundedAt: ago(1500) },
      payouts: [
        payout("col_lena", "Lena", "lena@example.com", 18000, ago(1400), "FAILED"),
      ],
      demo: true,
      createdAt: ago(1600),
      updatedAt: ago(1400),
      events: [
        ev("created", ago(1600), "Deal created for The Weekly Ledger"),
        ev("funded", ago(1500), "Payment captured (demo)"),
        ev("partial", ago(1400), "Payout failed: receiver email is unconfirmed"),
      ],
    },
  ];
}
