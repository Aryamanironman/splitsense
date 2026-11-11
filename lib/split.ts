import type { Collaborator, ShareRow, SplitResult } from "./types";

/**
 * All money math is deterministic and server-side. The model only extracts
 * percentages; it never calculates an amount.
 */
export function computeSplit(
  amountCents: number,
  taxPercent: number,
  collaborators: Collaborator[],
): SplitResult {
  const taxCents = Math.round((amountCents * taxPercent) / 100);
  let allocated = taxCents;
  let collaboratorPercent = 0;

  const rows: ShareRow[] = collaborators.map((c) => {
    const share = Math.round((amountCents * c.percent) / 100);
    allocated += share;
    collaboratorPercent += c.percent;
    return {
      id: c.id,
      name: c.name,
      role: c.role || "Collaborator",
      percent: c.percent,
      amountCents: share,
      kind: "collaborator" as const,
    };
  });

  const creatorCents = amountCents - allocated;

  rows.push({
    id: "tax",
    name: "Tax reserve",
    role: "Set aside",
    percent: taxPercent,
    amountCents: taxCents,
    kind: "tax",
  });
  rows.push({
    id: "creator",
    name: "Your share",
    role: "Creator",
    percent: Math.max(0, 100 - taxPercent - collaboratorPercent),
    amountCents: creatorCents,
    kind: "creator",
  });

  return {
    rows,
    taxCents,
    creatorCents,
    collaboratorTotalCents: amountCents - taxCents - creatorCents,
  };
}

export function validatePercentages(taxPercent: number, percents: number[]): string | null {
  if (taxPercent < 0 || taxPercent > 60) return "Tax must be between 0% and 60%";
  if (percents.some((p) => p < 0 || p > 60)) return "Each share must be between 0% and 60%";
  const total = taxPercent + percents.reduce((a, b) => a + b, 0);
  if (total > 95) return "Tax and collaborator shares must leave at least 5% for the creator";
  return null;
}
