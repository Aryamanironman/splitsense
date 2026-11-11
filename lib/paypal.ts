import type { DealPayment } from "./types";

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim();
const PAYPAL_ENV = process.env.PAYPAL_ENV === "production" ? "production" : "sandbox";
const API_BASE =
  PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "http://localhost:3200").replace(/\/$/, "");

export class PayPalError extends Error {
  readonly status: number;
  readonly debugId?: string;
  constructor(message: string, status = 502, debugId?: string) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.debugId = debugId;
  }
}

export class NeedsApprovalError extends Error {
  readonly approveUrl: string;
  constructor(approveUrl: string) {
    super("Payment still needs buyer approval");
    this.name = "NeedsApprovalError";
    this.approveUrl = approveUrl;
  }
}

export function paypalMode(): "live" | "mock" {
  return CLIENT_ID && CLIENT_SECRET ? "live" : "mock";
}

export function isLive(): boolean {
  return paypalMode() === "live";
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function mockId(prefix: string): string {
  return `MOCK-${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new PayPalError("PayPal credentials are not configured", 500);
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new PayPalError(`PayPal auth failed (${res.status})`, res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function paypalFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const payload = json as { message?: string; debug_id?: string } | null;
    throw new PayPalError(payload?.message || `PayPal request failed (${res.status})`, res.status, payload?.debug_id);
  }
  return json as T;
}

interface OrderResponse {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    payments?: {
      captures?: { id: string; status: string }[];
    };
  }[];
}

export async function createPaymentOrder(input: {
  dealId: string;
  title: string;
  amountCents: number;
}): Promise<DealPayment> {
  if (!isLive()) {
    return {
      mode: "mock",
      orderId: mockId("ORDER"),
      approveUrl: `${PUBLIC_BASE_URL}/deals/${input.dealId}`,
    };
  }
  const order = await paypalFetch<OrderResponse>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.dealId,
          description: `Creator payment: ${input.title}`.slice(0, 127),
          amount: { currency_code: "USD", value: dollars(input.amountCents) },
        },
      ],
      application_context: {
        brand_name: "SplitSense",
        user_action: "PAY_NOW",
        return_url: `${PUBLIC_BASE_URL}/deals/${input.dealId}?paypal=return`,
        cancel_url: `${PUBLIC_BASE_URL}/deals/${input.dealId}?paypal=cancel`,
      },
    }),
  });
  const approveUrl = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
  return { mode: "live", orderId: order.id, approveUrl };
}

export async function getPaymentOrder(
  orderId: string,
): Promise<{ status: string; approveUrl?: string; captureId?: string }> {
  if (!isLive()) {
    return { status: "APPROVED" };
  }
  const order = await paypalFetch<OrderResponse>(`/v2/checkout/orders/${orderId}`);
  return {
    status: order.status,
    approveUrl: order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href,
    captureId: order.purchase_units?.[0]?.payments?.captures?.[0]?.id,
  };
}

export async function capturePaymentOrder(orderId: string): Promise<{ captureId: string; status: string }> {
  if (!isLive()) {
    return { captureId: mockId("CAPTURE"), status: "COMPLETED" };
  }
  const result = await paypalFetch<OrderResponse>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new PayPalError("PayPal did not return a capture", 502);
  return { captureId: capture.id, status: capture.status };
}

export interface PayoutItemInput {
  id: string;
  name: string;
  email: string;
  amountCents: number;
}

export interface PayoutItemResult {
  id: string;
  name: string;
  email: string;
  amountCents: number;
  batchId: string;
  itemId: string;
  status: string;
  error?: string;
}

export async function sendSplitPayouts(input: {
  dealId: string;
  items: PayoutItemInput[];
  attempt?: number;
}): Promise<PayoutItemResult[]> {
  if (input.items.length === 0) return [];
  if (!isLive()) {
    return input.items.map((item) => ({
      ...item,
      batchId: mockId("BATCH"),
      itemId: mockId("ITEM"),
      status: "SUCCESS",
    }));
  }

  const attempt = input.attempt ?? 0;
  interface BatchItem {
    payout_item_id: string;
    transaction_status: string;
    payout_item?: { receiver?: string; sender_item_id?: string; amount?: { value: string } };
    errors?: { message?: string };
  }
  const batch = await paypalFetch<{
    batch_header?: { payout_batch_id: string; batch_status: string };
    items?: BatchItem[];
  }>("/v1/payments/payouts", {
    method: "POST",
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `splitsense-${input.dealId}${attempt ? `-r${attempt}` : ""}`.slice(0, 256),
        email_subject: "Your split from SplitSense",
        email_message: "A creator payment was split. Here is your share.",
      },
      items: input.items.map((item) => ({
        recipient_type: "EMAIL",
        amount: { currency: "USD", value: dollars(item.amountCents) },
        receiver: item.email,
        note: `Split for ${item.name}`.slice(0, 255),
        sender_item_id: item.id.slice(0, 63),
      })),
    }),
  });

  const batchId = batch.batch_header?.payout_batch_id || "";
  if (!batchId) throw new PayPalError("PayPal did not return a payout batch", 502);

  const byReceiver = new Map<string, BatchItem>();
  for (const item of batch.items || []) {
    const key = item.payout_item?.sender_item_id || item.payout_item?.receiver || "";
    byReceiver.set(key, item);
  }

  return input.items.map((item) => {
    const result = byReceiver.get(item.id) || byReceiver.get(item.email);
    return {
      ...item,
      batchId,
      itemId: result?.payout_item_id || "",
      status: result?.transaction_status || batch.batch_header?.batch_status || "PENDING",
      error: result?.errors?.message,
    };
  });
}

export interface PayoutBatchStatus {
  status: string;
  items: { id: string; email: string; status: string; itemId: string }[];
}

export async function getPayoutBatch(batchId: string): Promise<PayoutBatchStatus> {
  if (!isLive()) return { status: "SUCCESS", items: [] };
  const batch = await paypalFetch<{
    batch_header?: { batch_status: string };
    items?: {
      payout_item_id: string;
      transaction_status: string;
      payout_item?: { receiver?: string; sender_item_id?: string };
    }[];
  }>(`/v1/payments/payouts/${batchId}`);
  return {
    status: batch.batch_header?.batch_status || "",
    items: (batch.items || []).map((item) => ({
      id: item.payout_item?.sender_item_id || "",
      email: item.payout_item?.receiver || "",
      status: item.transaction_status,
      itemId: item.payout_item_id || "",
    })),
  };
}
