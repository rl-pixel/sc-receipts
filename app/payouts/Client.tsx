"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LineInput } from "@/components/Field";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PayoutForm({ sellerName, owed }: { sellerName: string; owed: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amountUsd, setAmountUsd] = useState("");
  const [paidAt, setPaidAt] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!amountUsd.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sellerName, amountUsd, paidAt, notes }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed");
      setAmountUsd("");
      setNotes("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (owed > 0) setAmountUsd((owed / 100).toFixed(2));
        }}
        className="bg-accent hover:bg-accent-deep text-white text-sm px-4 py-2 rounded-full transition-colors"
      >
        Log a payment to {sellerName}
      </button>
    );
  }

  return (
    <div className="bg-divider-soft border border-divider rounded-xl p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LineInput
          prefix="$"
          inputMode="decimal"
          placeholder="0.00"
          value={amountUsd}
          onChange={(e) => setAmountUsd(e.target.value)}
        />
        <input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className="bg-white border border-divider rounded-md px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft nums"
        />
      </div>
      <LineInput
        placeholder="Notes (optional — e.g. 'Venmo', 'Cash, March 15 sales')"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error ? <p className="text-xs text-warn">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving || !amountUsd.trim()}
          className="bg-accent hover:bg-accent-deep text-white text-sm px-4 py-2 rounded-full disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : `Save payment to ${sellerName}`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PayoutDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this payout record?")) return;
    setBusy(true);
    try {
      await fetch(`/api/payouts/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="text-xs text-muted hover:text-warn shrink-0"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
