"use client";

import { useEffect, useState } from "react";
import { formatUSD } from "@/lib/money";

export type MercuryTx = {
  id: string;
  amount: number;
  counterpartyName: string | null;
  counterpartyNickname: string | null;
  bankDescription: string | null;
  externalMemo: string | null;
  kind: string;
  status: string;
  postedAt: string | null;
  createdAt: string;
  accountId: string;
  accountName: string;
};

export function MercuryRecent({
  onPick,
  selectedId,
}: {
  onPick: (tx: MercuryTx) => void;
  selectedId?: string | null;
}) {
  const [txs, setTxs] = useState<MercuryTx[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/mercury/recent");
        if (!res.ok) {
          setTxs([]);
          if (res.status !== 503) setError("Couldn't reach Mercury.");
          return;
        }
        const data = await res.json();
        if (!cancelled) setTxs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setTxs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (txs === null) return null;
  if (txs.length === 0 && !error) return null;

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm text-muted font-medium">
          Recent Mercury payments — tap one to start a receipt
        </h2>
      </div>
      {error ? (
        <p className="text-xs text-warn">{error}</p>
      ) : (
        <div className="-mx-1 px-1 overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {txs.map((t) => {
              const selected = selectedId === t.id;
              const name =
                t.counterpartyNickname ?? t.counterpartyName ?? t.bankDescription ?? "Unknown";
              const date = new Date(t.postedAt ?? t.createdAt);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPick(t)}
                  className={`shrink-0 text-left rounded-2xl border px-4 py-3 transition-colors min-w-[180px] ${
                    selected
                      ? "bg-accent text-white border-accent"
                      : "bg-white border-divider hover:border-accent"
                  }`}
                >
                  <div className={`text-xs ${selected ? "opacity-80" : "text-muted"} nums`}>
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className={`text-base font-semibold nums ${selected ? "" : "text-ink"}`}>
                    {formatUSD(Math.round(t.amount * 100))}
                  </div>
                  <div className={`text-xs truncate ${selected ? "opacity-90" : "text-muted"}`}>
                    {name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
