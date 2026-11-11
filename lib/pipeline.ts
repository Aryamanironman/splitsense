import { randomUUID } from "node:crypto";
import { getDeal, insertDeal, updateDeal } from "./db";
import {
  capturePaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  getPayoutBatch,
  NeedsApprovalError,
  PayPalError,
  sendSplitPayouts,
} from "./paypal";
import { computeSplit } from "./split";
import type { CreateDealInput, Deal, DealEvent, Payout } from "./types";

export class PipelineError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "INVALID_STATE") {
    super(message);
    this.name = "PipelineError";
    this.status = status;
    this.code = code;
  }
}

function event(type: DealEvent["type"], message: string): DealEvent {
  return { id: randomUUID(), at: new Date().toISOString(), type, message };
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const id = `deal_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const collaborators = input.collaborators.map((c) => ({
    ...c,
    id: `col_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
  }));

  const split = computeSplit(input.amountCents, input.taxPercent, collaborators);
  if (split.creatorCents < 0) {
    throw new PipelineError("Shares add up to more than the payment", 400, "OVER_ALLOCATED");
  }

  const payment = await createPaymentOrder({
    dealId: id,
    title: input.title,
    amountCents: input.amountCents,
  });

  const now = new Date().toISOString();
  const deal: Deal = {
    id,
    title: input.title,
    brief: input.brief,
    payer: input.payer,
    amountCents: input.amountCents,
    currency: "USD",
    taxPercent: input.taxPercent,
    collaborators,
    status: "AWAITING_PAYMENT",
    payment,
    payouts: [],
    createdAt: now,
    updatedAt: now,
    events: [
      event("created", `Deal created for ${input.payer}`),
      event(
        "order_created",
        payment.mode === "live"
          ? `PayPal order ${payment.orderId} created`
          : `Demo payment order ${payment.orderId} created`,
      ),
    ],
  };
  return insertDeal(deal);
}

export async function fundDeal(id: string): Promise<Deal> {
  const deal = await getDeal(id);
  if (!deal) throw new PipelineError("Deal not found", 404, "NOT_FOUND");
  if (deal.status === "FUNDED" || deal.status === "SPLIT" || deal.status === "PARTIAL") return deal;
  if (!deal.payment?.orderId) throw new PipelineError("No payment order on this deal", 409, "NO_ORDER");

  const info = await getPaymentOrder(deal.payment.orderId);
  if (info.status === "CREATED") {
    throw new NeedsApprovalError(info.approveUrl || deal.payment.approveUrl || "");
  }

  let captureId = info.captureId;
  if (!captureId) {
    const captured = await capturePaymentOrder(deal.payment.orderId);
    captureId = captured.captureId;
  }

  const updated = await updateDeal(id, (d) => {
    d.status = "FUNDED";
    d.payment = {
      ...d.payment!,
      captureId,
      fundedAt: new Date().toISOString(),
    };
    d.events.push(event("funded", `Payment captured (${captureId})`));
  });
  return updated!;
}

export async function splitDeal(id: string, confirm: boolean): Promise<Deal> {
  if (!confirm) throw new PipelineError("Confirmation is required before paying out", 400, "NO_CONFIRM");
  const deal = await getDeal(id);
  if (!deal) throw new PipelineError("Deal not found", 404, "NOT_FOUND");
  if (deal.status === "SPLIT") throw new PipelineError("This deal is already paid out", 409, "ALREADY_SPLIT");
  if (deal.status !== "FUNDED" && deal.status !== "PARTIAL") {
    throw new PipelineError("Fund the deal before splitting it", 409, "NOT_FUNDED");
  }

  const split = computeSplit(deal.amountCents, deal.taxPercent, deal.collaborators);
  const existing = new Map(deal.payouts.map((p) => [p.id, p]));
  const collaboratorRows = split.rows.filter((r) => r.kind === "collaborator");
  const emailById = new Map(deal.collaborators.map((c) => [c.id, c.email]));

  // SUCCESS, PENDING and UNCLAIMED must not be sent again.
  const items = collaboratorRows
    .filter((r) => {
      const prior = existing.get(r.id);
      return !prior || prior.status === "FAILED";
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: emailById.get(r.id) || "",
      amountCents: r.amountCents,
    }))
    .filter((i) => i.email.length > 0);

  const attempt = deal.events.filter((e) => e.type === "partial" || e.type === "failed").length;
  let results: Payout[] = [];
  if (items.length > 0) {
    try {
      const sent = await sendSplitPayouts({ dealId: id, items, attempt });
      const at = new Date().toISOString();
      results = sent.map((r) => ({ ...r, at }));
    } catch (error) {
      await updateDeal(id, (d) => {
        d.status = "PARTIAL";
        d.events.push(
          event(
            "failed",
            error instanceof PayPalError ? `Payout failed: ${error.message}` : "Payout failed",
          ),
        );
      });
      throw error;
    }
  }

  const merged = [
    ...deal.payouts.filter((p) => !results.some((r) => r.id === p.id)),
    ...results,
  ];
  const byId = new Map(merged.map((p) => [p.id, p]));
  const allSuccess = collaboratorRows.every((r) => byId.get(r.id)?.status === "SUCCESS");

  const updated = await updateDeal(id, (d) => {
    d.payouts = merged;
    d.status = allSuccess ? "SPLIT" : "PARTIAL";
    d.events.push(
      event(
        allSuccess ? "split" : "partial",
        allSuccess
          ? `Split paid to ${results.length || "all"} collaborator${results.length === 1 ? "" : "s"}; tax and creator share retained`
          : `Payout incomplete: ${merged.filter((p) => p.status !== "SUCCESS").length} not settled`,
      ),
    );
  });
  return updated!;
}

/**
 * Payout batches settle asynchronously. Pull the current item statuses for a
 * deal that is waiting on a batch, so the ledger reflects PayPal rather than
 * the initial PENDING response.
 */
export async function refreshPayouts(id: string): Promise<Deal | null> {
  const deal = await getDeal(id);
  if (!deal || deal.payouts.length === 0 || deal.status === "SPLIT") return deal;

  const batchIds = Array.from(new Set(deal.payouts.map((p) => p.batchId).filter(Boolean)));
  if (batchIds.length === 0) return deal;

  const updates = new Map<string, { status: string; itemId: string }>();
  for (const batchId of batchIds) {
    const batch = await getPayoutBatch(batchId);
    for (const item of batch.items) {
      if (item.id) updates.set(item.id, { status: item.status, itemId: item.itemId });
      if (item.email) updates.set(item.email, { status: item.status, itemId: item.itemId });
    }
  }

  let changed = false;
  const merged = deal.payouts.map((payout) => {
    const update = updates.get(payout.id) || updates.get(payout.email);
    if (!update) return payout;
    if (update.status !== payout.status || (update.itemId && update.itemId !== payout.itemId)) {
      changed = true;
      return { ...payout, status: update.status, itemId: update.itemId || payout.itemId };
    }
    return payout;
  });

  if (!changed) return deal;

  const allSuccess = deal.collaborators.every(
    (c) => merged.find((p) => p.id === c.id)?.status === "SUCCESS",
  );
  const status = allSuccess ? "SPLIT" : "PARTIAL";
  const updated = await updateDeal(id, (d) => {
    d.payouts = merged;
    d.status = status;
    if (status === "SPLIT") {
      d.events.push(event("split", "All payouts settled"));
    }
  });
  return updated;
}
