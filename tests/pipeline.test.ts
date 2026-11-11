import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createDeal, fundDeal, splitDeal } from "../lib/pipeline";

const INPUT = {
  title: "Autumn campaign film",
  brief: "Brand deal with collaborators.",
  payer: "Northwind Studio",
  amountCents: 400000,
  taxPercent: 25,
  collaborators: [
    { name: "Sam", role: "Editor", email: "sam@example.com", percent: 30 },
    { name: "Priya", role: "Artist", email: "priya@example.com", percent: 15 },
  ],
};

beforeAll(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "splitsense-test-"));
  process.env.DATA_DIR = dir;
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.AI_API_KEY;
});

describe("deal pipeline", () => {
  it("runs create → fund → split", async () => {
    const deal = await createDeal(INPUT);
    expect(deal.status).toBe("AWAITING_PAYMENT");

    const funded = await fundDeal(deal.id);
    expect(funded.status).toBe("FUNDED");
    expect(funded.payment?.captureId).toBeTruthy();

    const split = await splitDeal(deal.id, true);
    expect(split.status).toBe("SPLIT");
    expect(split.payouts).toHaveLength(2);
    expect(split.payouts.every((p) => p.status === "SUCCESS")).toBe(true);
  });

  it("refuses to split before funding", async () => {
    const deal = await createDeal({ ...INPUT, title: "Second deal" });
    await expect(splitDeal(deal.id, true)).rejects.toMatchObject({ code: "NOT_FUNDED" });
  });

  it("requires explicit confirmation", async () => {
    const deal = await createDeal({ ...INPUT, title: "Third deal" });
    await fundDeal(deal.id);
    await expect(splitDeal(deal.id, false)).rejects.toMatchObject({ code: "NO_CONFIRM" });
  });

  it("refuses a second split", async () => {
    const deal = await createDeal({ ...INPUT, title: "Fourth deal" });
    await fundDeal(deal.id);
    await splitDeal(deal.id, true);
    await expect(splitDeal(deal.id, true)).rejects.toMatchObject({ code: "ALREADY_SPLIT" });
  });
});
