import { describe, expect, it } from "vitest";
import { computeSplit, validatePercentages } from "../lib/split";
import type { Collaborator } from "../lib/types";

const collaborators: Collaborator[] = [
  { id: "sam", name: "Sam", email: "sam@example.com", role: "Editor", percent: 30 },
  { id: "priya", name: "Priya", email: "priya@example.com", role: "Artist", percent: 15 },
];

describe("computeSplit", () => {
  it("splits 4,000 with 25% tax into exact cents", () => {
    const result = computeSplit(400000, 25, collaborators);
    expect(result.taxCents).toBe(100000);
    expect(result.creatorCents).toBe(120000);
    expect(result.collaboratorTotalCents).toBe(180000);
    expect(result.rows.find((r) => r.id === "sam")?.amountCents).toBe(120000);
    expect(result.rows.find((r) => r.id === "priya")?.amountCents).toBe(60000);
    expect(result.rows.reduce((sum, r) => sum + r.amountCents, 0)).toBe(400000);
  });

  it("gives rounding remainder to the creator", () => {
    const result = computeSplit(10001, 10, [
      { id: "a", name: "A", email: "a@b.co", role: "Editor", percent: 33.33 },
    ]);
    expect(result.rows.reduce((sum, r) => sum + r.amountCents, 0)).toBe(10001);
    expect(result.creatorCents).toBeGreaterThanOrEqual(0);
  });

  it("computes a zero creator share when fully allocated", () => {
    const result = computeSplit(10000, 40, [
      { id: "a", name: "A", email: "a@b.co", role: "Editor", percent: 60 },
    ]);
    expect(result.creatorCents).toBe(0);
  });
});

describe("validatePercentages", () => {
  it("accepts a split that leaves at least 5%", () => {
    expect(validatePercentages(25, [30, 15])).toBeNull();
  });

  it("rejects an over-allocated split", () => {
    expect(validatePercentages(40, [40, 20])).toMatch(/at least 5%/);
  });

  it("rejects out-of-range shares", () => {
    expect(validatePercentages(10, [70])).toMatch(/between 0% and 60%/);
  });
});
