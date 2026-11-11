import { beforeAll, describe, expect, it } from "vitest";
import { parseDealBrief } from "../lib/ai";

beforeAll(() => {
  delete process.env.AI_API_KEY;
});

describe("parseDealBrief fallback rules", () => {
  it("reads amount, tax and named percentages", async () => {
    const parsed = await parseDealBrief(
      "I closed a $4,000 brand deal from Northwind Studio. Sam gets 30%, Priya gets 15%, and 25% for tax.",
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(400000);
    expect(parsed?.taxPercent).toBe(25);
    expect(parsed?.collaborators).toHaveLength(2);
    expect(parsed?.collaborators[0].name).toBe("Sam");
    expect(parsed?.collaborators[0].percent).toBe(30);
    expect(parsed?.source).toBe("rules");
  });

  it("returns null when no percentages are present", async () => {
    expect(await parseDealBrief("A brand paid me four thousand dollars.")).toBeNull();
  });

  it("returns null when the split over-allocates", async () => {
    const parsed = await parseDealBrief("$1,000 from Acme. Sam gets 60%, Priya gets 30%, 20% for tax.");
    expect(parsed).toBeNull();
  });
});
