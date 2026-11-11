"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeedButton({ label = "Load demo deals" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={seed} disabled={busy}>
      {busy ? <span className="spinner spinner-dark" /> : null}
      {busy ? "Loading…" : label}
    </button>
  );
}
