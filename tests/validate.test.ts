import { describe, expect, it } from "vitest";
import { parseCreateDeal } from "../lib/validate";

const VALID = {
  title: "Autumn campaign film",
  payer: "Northwind Studio",
  amountCents: 400000,
  taxPercent: 25,
  collaborators: [
    { name: "Sam", role: "Editor", email: "sam@example.com", percent: 30 },
    { name: "Priya", role: "Artist", email: "priya@example.com", percent: 15 },
  ],
};

describe("parseCreateDeal", () => {
  it("accepts a valid deal", () => {
    const result = parseCreateDeal(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.collaborators).toHaveLength(2);
    expect(result.value.amountCents).toBe(400000);
  });

  it("accepts a dollar amount instead of cents", () => {
    const result = parseCreateDeal({ ...VALID, amountCents: undefined, amount: 4000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountCents).toBe(400000);
  });

  it("rejects a missing PayPal email", () => {
    const result = parseCreateDeal({
      ...VALID,
      collaborators: [{ name: "Sam", role: "Editor", email: "", percent: 30 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects over-allocation", () => {
    const result = parseCreateDeal({ ...VALID, taxPercent: 55 });
    expect(result.ok).toBe(false);
  });

  it("rejects a deal without collaborators", () => {
    const result = parseCreateDeal({ ...VALID, collaborators: [] });
    expect(result.ok).toBe(false);
  });
});
