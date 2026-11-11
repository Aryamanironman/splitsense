"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SplitBar, SplitLegend } from "@/components/SplitBar";
import { computeSplit } from "@/lib/split";
import type { Collaborator } from "@/lib/types";

interface Row {
  name: string;
  role: string;
  email: string;
  percent: string;
}

const BLANK: Row = { name: "", role: "", email: "", percent: "" };

export function NewDealForm() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("20");
  const [rows, setRows] = useState<Row[]>([{ ...BLANK, role: "Editor" }, { ...BLANK, role: "Artist" }]);
  const [busy, setBusy] = useState<"parse" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "rules" | null>(null);

  function setRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const previewCollaborators: Collaborator[] = useMemo(
    () =>
      rows
        .filter((r) => r.name.trim() && Number(r.percent) > 0)
        .map((r, i) => ({
          id: `tmp_${i}`,
          name: r.name.trim(),
          role: r.role.trim() || "Collaborator",
          email: r.email.trim(),
          percent: Math.min(60, Math.max(0, Number(r.percent) || 0)),
        })),
    [rows],
  );

  const amountCents = Math.max(0, Math.round((Number(amount) || 0) * 100));
  const taxPercent = Math.min(60, Math.max(0, Number(tax) || 0));
  const preview = computeSplit(amountCents, taxPercent, previewCollaborators);
  const previewInput = { amountCents, taxPercent, collaborators: previewCollaborators };

  async function parseBrief() {
    setBusy("parse");
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const json = (await res.json()) as {
        error?: string;
        source?: "ai" | "rules";
        parsed?: {
          title: string;
          payer: string;
          amountCents: number;
          taxPercent: number;
          collaborators: { name: string; role: string; percent: number; email: string }[];
        };
      };
      if (!res.ok || !json.parsed) throw new Error(json.error || "Could not read the deal");
      setTitle(json.parsed.title);
      setPayer(json.parsed.payer);
      setAmount((json.parsed.amountCents / 100).toFixed(2));
      setTax(String(json.parsed.taxPercent));
      setRows(
        json.parsed.collaborators.length
          ? json.parsed.collaborators.map((c) => ({
              name: c.name,
              role: c.role,
              email: c.email,
              percent: String(c.percent),
            }))
          : [{ ...BLANK }],
      );
      setSource(json.source || "rules");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the deal");
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          brief,
          payer,
          amountCents,
          taxPercent,
          collaborators: rows
            .filter((r) => r.name.trim())
            .map((r) => ({
              name: r.name.trim(),
              role: r.role.trim() || "Collaborator",
              email: r.email.trim(),
              percent: Number(r.percent) || 0,
            })),
        }),
      });
      const json = (await res.json()) as { error?: string; deal?: { id: string } };
      if (!res.ok || !json.deal) throw new Error(json.error || `Request failed (${res.status})`);
      router.push(`/deals/${json.deal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the deal");
      setBusy(null);
    }
  }

  return (
    <form className="form-panel" onSubmit={submit} autoComplete="off">
      <div className="field full">
        <label htmlFor="brief">Describe the deal</label>
        <textarea
          id="brief"
          rows={4}
          autoComplete="off"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="I closed a $4,000 brand deal with Northwind Studio. Sam edited and gets 30%. Priya made the thumbnails and gets 15%. Set aside 25% for tax."
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={parseBrief}
            disabled={busy !== null || brief.trim().length < 8}
          >
            {busy === "parse" ? <span className="spinner" /> : null}
            {busy === "parse" ? "Reading…" : "Read the deal with AI"}
          </button>
          <span className="helper">
            {source === "ai"
              ? "Read by Groq. Check every percentage below."
              : source === "rules"
                ? "Read by the offline rule parser. Check every percentage below."
                : "The model extracts percentages; the server calculates every amount."}
          </span>
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 18 }}>
        <div className="field">
          <label htmlFor="title">Deal title</label>
          <input id="title" required autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Autumn campaign film" />
        </div>
        <div className="field">
          <label htmlFor="payer">Paying brand</label>
          <input id="payer" required autoComplete="off" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Northwind Studio" />
        </div>
        <div className="field">
          <label htmlFor="amount">Payment amount (USD)</label>
          <input
            id="amount"
            required
            autoComplete="off"
            type="number"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="4000.00"
          />
        </div>
        <div className="field">
          <label htmlFor="tax">Tax reserve %</label>
          <input
            id="tax"
            type="number"
            min={0}
            max={60}
            step="0.1"
            autoComplete="off"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="section-kicker" style={{ marginBottom: 10 }}>
          Collaborators
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row, index) => (
            <div className="collab-row" key={index}>
              <div className="field">
                <label htmlFor={`name-${index}`}>Name</label>
                <input
                  id={`name-${index}`}
                  autoComplete="off"
                  value={row.name}
                  onChange={(e) => setRow(index, { name: e.target.value })}
                  placeholder="Sam"
                />
              </div>
              <div className="field">
                <label htmlFor={`role-${index}`}>Role</label>
                <input
                  id={`role-${index}`}
                  value={row.role}
                  onChange={(e) => setRow(index, { role: e.target.value })}
                  placeholder="Editor"
                />
              </div>
              <div className="field">
                <label htmlFor={`email-${index}`}>PayPal email</label>
                <input
                  id={`email-${index}`}
                  type="email"
                  autoComplete="off"
                  value={row.email}
                  onChange={(e) => setRow(index, { email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="field">
                <label htmlFor={`percent-${index}`}>Share %</label>
                <input
                  id={`percent-${index}`}
                  type="number"
                  min={1}
                  max={60}
                  step="0.1"
                  autoComplete="off"
                  value={row.percent}
                  onChange={(e) => setRow(index, { percent: e.target.value })}
                  placeholder="30"
                />
              </div>
              <button
                type="button"
                className="remove-btn"
                aria-label={`Remove ${row.name || "collaborator"}`}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                disabled={rows.length === 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-link"
          style={{ marginTop: 10 }}
          onClick={() => setRows((current) => [...current, { ...BLANK }])}
          disabled={rows.length >= 8}
        >
          + Add collaborator
        </button>
      </div>

      <div className="preview-box">
        <div className="preview-title">Split preview</div>
        <SplitBar input={previewInput} />
        <SplitLegend input={previewInput} />
        <p className="helper" style={{ marginTop: 10 }}>
          {formatPreview(preview.creatorCents, taxPercent)}
        </p>
      </div>

      {error ? <div className="notice notice-error" style={{ marginTop: 14 }}>{error}</div> : null}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy !== null}>
          {busy === "create" ? <span className="spinner" /> : null}
          {busy === "create" ? "Creating…" : "Create deal & request payment"}
        </button>
        <span className="helper">
          The brand pays once in PayPal. Nothing is split until you confirm.
        </span>
      </div>
    </form>
  );
}

function formatPreview(creatorCents: number, taxPercent: number): string {
  const creator = Math.max(0, creatorCents);
  return `Creator share after collaborators and ${taxPercent}% tax: $${(creator / 100).toFixed(2)}. Amounts are computed in cents on the server.`;
}
