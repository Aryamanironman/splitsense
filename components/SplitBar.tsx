import { formatMoney, formatPercent } from "@/lib/format";
import { computeSplit } from "@/lib/split";
import type { Collaborator, ShareRow } from "@/lib/types";

const COLORS = ["seg-coral", "seg-gold", "seg-plum", "seg-blue"];
const DOT_COLORS = ["var(--coral)", "var(--gold)", "var(--plum)", "var(--blue)"];

export interface SplitInput {
  amountCents: number;
  taxPercent: number;
  collaborators: Collaborator[];
}

function colorFor(row: ShareRow, index: number): { seg: string; dot: string } {
  if (row.kind === "tax") return { seg: "seg-muted", dot: "#b9a88d" };
  if (row.kind === "creator") return { seg: "seg-teal", dot: "var(--teal)" };
  return {
    seg: COLORS[index % COLORS.length],
    dot: DOT_COLORS[index % DOT_COLORS.length],
  };
}

export function SplitBar({ input, compact = false }: { input: SplitInput; compact?: boolean }) {
  const split = computeSplit(input.amountCents, input.taxPercent, input.collaborators);
  return (
    <div className={compact ? "mini-bar" : "split-bar"} aria-label="Split of the payment">
      {split.rows.map((row, index) => {
        const color = colorFor(row, index);
        return (
          <div
            key={row.id}
            className={`split-segment ${color.seg}`}
            style={{ width: `${Math.max(0, row.percent)}%` }}
            title={`${row.name}: ${formatPercent(row.percent)} (${formatMoney(row.amountCents)})`}
          />
        );
      })}
    </div>
  );
}

export function SplitLegend({ input }: { input: SplitInput }) {
  const split = computeSplit(input.amountCents, input.taxPercent, input.collaborators);
  return (
    <div className="split-legend">
      {split.rows.map((row, index) => {
        const color = colorFor(row, index);
        return (
          <div key={row.id} className="legend-row">
            <span className="legend-dot" style={{ background: color.dot }} />
            <span>
              <span className="legend-name">{row.name}</span>{" "}
              <span className="legend-role">{row.role}</span>
            </span>
            <span className="legend-pct mono">{formatPercent(row.percent)}</span>
            <span className="legend-money">{formatMoney(row.amountCents)}</span>
          </div>
        );
      })}
    </div>
  );
}
