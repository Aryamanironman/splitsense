import { describe, expect, it } from "vitest";
import {
  capturePaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  paypalMode,
  sendSplitPayouts,
} from "../lib/paypal";

describe("PayPal client in mock mode", () => {
  it("reports mock mode", () => {
    expect(paypalMode()).toBe("mock");
  });

  it("creates a mock payment order", async () => {
    const payment = await createPaymentOrder({
      dealId: "deal_1",
      title: "Test deal",
      amountCents: 400000,
    });
    expect(payment.mode).toBe("mock");
    expect(payment.orderId).toMatch(/^MOCK-ORDER-/);
    expect(payment.approveUrl).toContain("/deals/deal_1");
  });

  it("reports an approvable order and captures it", async () => {
    const info = await getPaymentOrder("MOCK-ORDER-X");
    expect(info.status).toBe("APPROVED");
    const capture = await capturePaymentOrder("MOCK-ORDER-X");
    expect(capture.captureId).toMatch(/^MOCK-CAPTURE-/);
    expect(capture.status).toBe("COMPLETED");
  });

  it("sends a multi-item payout batch", async () => {
    const results = await sendSplitPayouts({
      dealId: "deal_1",
      items: [
        { id: "sam", name: "Sam", email: "sam@example.com", amountCents: 120000 },
        { id: "priya", name: "Priya", email: "priya@example.com", amountCents: 60000 },
      ],
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "SUCCESS")).toBe(true);
    expect(results[0].batchId).toMatch(/^MOCK-BATCH-/);
  });
});
