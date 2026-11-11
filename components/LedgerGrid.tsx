"use client";

import { useEffect, useRef, useState } from "react";
import { createGrid, type ColDef, type GridApi } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { formatMoney } from "@/lib/format";

export interface LedgerRow {
  id: string;
  payee: string;
  role: string;
  kind: string;
  percent: number;
  amountCents: number;
  status: string;
  reference: string;
}

const STATUS_COLORS: Record<string, string> = {
  Paid: "#0e7c6b",
  Pending: "#8a6615",
  Unclaimed: "#8a6615",
  Failed: "#b23b3b",
  Unpaid: "#6f6456",
  Reserved: "#6f6456",
  Retained: "#0e7c6b",
};

export function LedgerGrid({ rows }: { rows: LedgerRow[] }) {
  const host = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GridApi<LedgerRow> | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!host.current) return;
    const columnDefs: ColDef<LedgerRow>[] = [
      {
        field: "payee",
        headerName: "Payee",
        pinned: "left",
        width: 118,
        minWidth: 118,
      },
      { field: "role", headerName: "Role", flex: 1, minWidth: 90 },
      {
        field: "amountCents",
        headerName: "Amount",
        flex: 1,
        minWidth: 96,
        type: "numericColumn",
        valueFormatter: (p) => formatMoney(Number(p.value ?? 0)),
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.8,
        minWidth: 86,
        cellStyle: (p) => ({ color: STATUS_COLORS[String(p.value)] || "#6f6456", fontWeight: 600 }),
      },
      { field: "reference", headerName: "PayPal ref", flex: 1.2, minWidth: 100 },
    ];

    const api = createGrid(host.current, {
      columnDefs,
      rowData: rows,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 80,
      },
      getRowId: (p) => p.data.id,
      headerHeight: 38,
      rowHeight: 40,
      animateRows: true,
      suppressMovableColumns: true,
      quickFilterText: query,
      tooltipShowDelay: 300,
      onGridReady: (event) => event.api.sizeColumnsToFit(),
      onGridSizeChanged: (event) => event.api.sizeColumnsToFit(),
    });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
    // The grid is rebuilt only when the row set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    apiRef.current?.setGridOption("quickFilterText", query);
  }, [query]);

  const total = rows.reduce((sum, r) => sum + r.amountCents, 0);

  return (
    <div>
      <div className="ledger-toolbar">
        <input
          className="ledger-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search payee, role, status…"
          aria-label="Search the ledger"
        />
        <span className="ledger-total">Total {formatMoney(total)}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => apiRef.current?.exportDataAsCsv({ fileName: "splitsense-ledger.csv" })}
        >
          Export CSV
        </button>
      </div>
      <div ref={host} className="ag-theme-quartz grid-shell" />
      <p className="ledger-hint">
        Sort by amount, filter by status, search, or export. Built on AG Grid Community.
      </p>
    </div>
  );
}
