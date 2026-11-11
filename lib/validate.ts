import { validatePercentages } from "./split";
import type { CreateDealInput } from "./types";

export type ValidationResult =
  | { ok: true; value: CreateDealInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseCreateDeal(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Expected a JSON body" };
  const input = body as Record<string, unknown>;

  const title = text(input.title, 120);
  if (title.length < 3) return { ok: false, error: "Give the deal a title" };
  const payer = text(input.payer, 80);
  if (payer.length < 2) return { ok: false, error: "Who is paying?" };

  const amountCents = Math.round(
    input.amountCents != null ? Number(input.amountCents) : Number(input.amount) * 100,
  );
  if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 10_000_000) {
    return { ok: false, error: "Amount must be between $1 and $100,000" };
  }

  const taxPercent = Number(input.taxPercent ?? 0);
  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 60) {
    return { ok: false, error: "Tax must be between 0% and 60%" };
  }

  const raw = Array.isArray(input.collaborators) ? input.collaborators : [];
  if (raw.length === 0) return { ok: false, error: "Add at least one collaborator" };
  if (raw.length > 8) return { ok: false, error: "At most eight collaborators" };

  const collaborators: CreateDealInput["collaborators"] = [];
  for (const entry of raw) {
    const c = (entry || {}) as Record<string, unknown>;
    const name = text(c.name, 60);
    const email = text(c.email, 160).toLowerCase();
    const role = text(c.role, 40) || "Collaborator";
    const percent = Number(c.percent);
    if (!name) return { ok: false, error: "Every collaborator needs a name" };
    if (!EMAIL_RE.test(email)) return { ok: false, error: `Add a valid PayPal email for ${name}` };
    if (!Number.isFinite(percent) || percent < 1 || percent > 60) {
      return { ok: false, error: `${name}'s share must be between 1% and 60%` };
    }
    collaborators.push({ name, email, role, percent: Math.round(percent * 10) / 10 });
  }

  const percentError = validatePercentages(taxPercent, collaborators.map((c) => c.percent));
  if (percentError) return { ok: false, error: percentError };

  return {
    ok: true,
    value: {
      title,
      brief: text(input.brief, 2000),
      payer,
      amountCents,
      taxPercent: Math.round(taxPercent * 10) / 10,
      collaborators,
    },
  };
}
