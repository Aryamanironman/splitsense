export type DealStatus = "AWAITING_PAYMENT" | "FUNDED" | "SPLIT" | "PARTIAL";

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: string;
  percent: number;
}

export interface Payout {
  id: string;
  name: string;
  email: string;
  amountCents: number;
  batchId: string;
  itemId: string;
  status: string;
  at: string;
  error?: string;
}

export interface DealPayment {
  mode: "live" | "mock";
  orderId: string;
  approveUrl?: string;
  captureId?: string;
  fundedAt?: string;
}

export type DealEventType =
  | "created"
  | "order_created"
  | "funded"
  | "split"
  | "partial"
  | "failed";

export interface DealEvent {
  id: string;
  at: string;
  type: DealEventType;
  message: string;
}

export interface Deal {
  id: string;
  title: string;
  brief: string;
  payer: string;
  amountCents: number;
  currency: "USD";
  taxPercent: number;
  collaborators: Collaborator[];
  status: DealStatus;
  payment?: DealPayment;
  payouts: Payout[];
  demo?: boolean;
  createdAt: string;
  updatedAt: string;
  events: DealEvent[];
}

export type ShareKind = "collaborator" | "tax" | "creator";

export interface ShareRow {
  id: string;
  name: string;
  role: string;
  percent: number;
  amountCents: number;
  kind: ShareKind;
}

export interface SplitResult {
  rows: ShareRow[];
  taxCents: number;
  creatorCents: number;
  collaboratorTotalCents: number;
}

export interface CreateDealInput {
  title: string;
  brief: string;
  payer: string;
  amountCents: number;
  taxPercent: number;
  collaborators: { name: string; email: string; role: string; percent: number }[];
}

export const STATUS_LABEL: Record<DealStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  FUNDED: "Funded",
  SPLIT: "Split and paid",
  PARTIAL: "Partial payout",
};
