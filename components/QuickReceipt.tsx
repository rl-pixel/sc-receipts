"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Search, X, Pencil, Sparkles } from "lucide-react";
import type { MercuryTx } from "@/components/MercuryRecent";
import { PillToggle } from "@/components/PillToggle";
import { LineInput } from "@/components/Field";
import { formatUSD, dollarsToCents } from "@/lib/money";
import { copy } from "@/lib/copy";

type Seller = { id: string; name: string };
type Bank = { id: string; label: string; acceptsZelle: boolean; acceptsWire: boolean };

export function QuickReceipt({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const router = useRouter();

  // Mercury data
  const [txs, setTxs] = useState<MercuryTx[]>([]);
  const [picked, setPicked] = useState<MercuryTx | null>(null);

  // Search
  const [query, setQuery] = useState("");

  // Watch
  const [refNum, setRefNum] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [watchSummary, setWatchSummary] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  // Customer enrichment from Mercury detail (optional)
  const [enrichedAddress, setEnrichedAddress] = useState("");
  const [enrichedConfirmation, setEnrichedConfirmation] = useState("");

  // Sellers + banks
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [soldBy, setSoldBy] = useState("Joe");

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refInputRef = useRef<HTMLInputElement>(null);

  // Initial load: Mercury, sellers, banks
  useEffect(() => {
    void (async () => {
      const [tx, s, b] = await Promise.all([
        fetch("/api/mercury/recent")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch("/api/sellers")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch("/api/banks")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);
      setTxs(Array.isArray(tx) ? tx : []);
      setSellers(s);
      setBanks(b);
    })();
  }, []);

  // Filter Mercury txs by query (name or amount)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return txs.slice(0, 6);
    const numQ = Number(q.replace(/[$,]/g, ""));
    const isNum = !Number.isNaN(numQ) && numQ > 0;
    return txs
      .filter((t) => {
        const name = (
          t.counterpartyName ??
          t.counterpartyNickname ??
          ""
        ).toLowerCase();
        if (name.includes(q)) return true;
        if (isNum) {
          const amt = Math.round(t.amount);
          if (amt === Math.round(numQ)) return true;
          if (String(amt).startsWith(String(Math.round(numQ)))) return true;
        }
        return false;
      })
      .slice(0, 6);
  }, [query, txs]);

  function pickTx(tx: MercuryTx) {
    setPicked(tx);
    setQuery("");
    // Fetch detail for enrichment (best-effort)
    void (async () => {
      try {
        const res = await fetch(
          `/api/mercury/transaction?accountId=${encodeURIComponent(tx.accountId)}&id=${encodeURIComponent(tx.id)}`,
        );
        if (!res.ok) return;
        const detail = await res.json();
        const d = detail?.details ?? {};
        const wd = d.wireDetails ?? d.wire ?? {};
        const orig = wd.originator ?? wd.senderAddress ?? d.originator ?? null;
        const parts: string[] = [];
        if (typeof orig === "string") parts.push(orig);
        else if (orig && typeof orig === "object") {
          for (const k of [
            "addressLine1",
            "addressLine2",
            "city",
            "state",
            "zip",
            "country",
          ]) {
            if (orig[k]) parts.push(String(orig[k]));
          }
        }
        if (parts.length) setEnrichedAddress(parts.join("\n"));
        const conf =
          wd.imadId ??
          wd.imad ??
          wd.referenceNumber ??
          d.referenceNumber ??
          null;
        if (conf) setEnrichedConfirmation(String(conf));
      } catch {
        /* enrichment is optional */
      }
    })();
    // Auto-focus the ref input next
    setTimeout(() => refInputRef.current?.focus(), 50);
  }

  function clearPick() {
    setPicked(null);
    setEnrichedAddress("");
    setEnrichedConfirmation("");
    setRefNum("");
    setBrand("");
    setModel("");
    setYear("");
    setWatchSummary(null);
  }

  async function lookupWatch() {
    const r = refNum.trim();
    if (!r || looking) return;
    setLooking(true);
    try {
      const res = await fetch("/api/lookup-watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref: r }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.brand) setBrand(data.brand);
      if (data.model) setModel(data.model);
      if (data.year_introduced) setYear(String(data.year_introduced));
      if (data.summary) setWatchSummary(data.summary);
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    if (!picked || submitting) return;
    if (!brand.trim() || !model.trim()) {
      setError("Watch brand + model required. Type a reference and tap Look up.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const senderName =
        picked.counterpartyName ?? picked.counterpartyNickname ?? "";
      const dateStr = (picked.postedAt ?? picked.createdAt).slice(0, 10);
      const method = picked.kind.toLowerCase().includes("wire")
        ? "Wire"
        : "Other";
      const methodOther =
        method === "Other"
          ? picked.kind === "checkDeposit"
            ? "Check"
            : "ACH"
          : "";
      // Pick a bank — match the kind to one of Joe's banks if possible
      const bankId =
        method === "Wire"
          ? banks.find((b) => b.acceptsWire && !b.acceptsZelle)?.id ??
            banks[0]?.id ??
            ""
          : banks[0]?.id ?? "";

      const formPayload = {
        payment: {
          sender: senderName,
          amountUsd: String(picked.amount),
          date: dateStr,
          confirmation: enrichedConfirmation,
          method,
          methodOther,
          bankAccountId: bankId,
        },
        customer: {
          name: senderName,
          email: "",
          phone: "",
          addressLines: enrichedAddress,
          street: "",
          city: "",
          state: "",
          zip: "",
        },
        watch: {
          brand,
          model,
          referenceNumber: refNum,
          year,
          condition: "New",
          hasBox: true,
          hasPapers: true,
          serial: "",
        },
        seller: {
          soldBy,
          commissionType: null,
          commissionValue: "",
        },
        totals: { shippingUsd: "", taxUsd: "" },
        notes: "",
      };
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form: formPayload }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Save failed");
      const created = await res.json();
      void confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.55 },
        colors: ["#0052ff", "#00d924", "#ffc93c", "#ffffff"],
      });
      setTimeout(() => router.push(`/history/${created.id}?just_created=1`), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step 1: pick a Mercury payment */}
      {!picked ? (
        <div className="flex flex-col gap-3">
          <label className="block">
            <div className="text-sm text-muted mb-2">
              {query.trim()
                ? "Filtering recent payments"
                : "Tap a recent payment, or type to filter"}
            </div>
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-soft"
              />
              <input
                type="text"
                placeholder="$4,500   or   Brian"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white border border-divider rounded-2xl pl-12 pr-4 py-3.5 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors"
              />
            </div>
          </label>

          {matches.length > 0 ? (
            <ul className="bg-white border border-divider rounded-2xl divide-y divide-divider overflow-hidden">
              {matches.map((t) => {
                const name =
                  t.counterpartyName ?? t.counterpartyNickname ?? "Unknown";
                const date = new Date(t.postedAt ?? t.createdAt);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => pickTx(t)}
                      className="w-full grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-3 text-left hover:bg-divider-soft active:bg-accent-soft transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-base text-ink truncate">{name}</div>
                        <div className="text-xs text-muted">
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" · "}
                          {t.kind.toLowerCase().includes("wire")
                            ? "Wire"
                            : t.kind === "checkDeposit"
                              ? "Check"
                              : "ACH"}
                          {" · "}
                          {t.accountName}
                        </div>
                      </div>
                      <div className="text-base font-semibold text-ink nums shrink-0">
                        {formatUSD(Math.round(t.amount * 100))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : query.trim() ? (
            <div className="text-sm text-muted bg-white border border-divider rounded-2xl px-4 py-3">
              Nothing matches in Mercury.{" "}
              <button
                type="button"
                onClick={onSwitchToManual}
                className="text-accent underline-offset-2 hover:underline"
              >
                Type it in instead
              </button>
              .
            </div>
          ) : (
            <div className="text-sm text-muted bg-white border border-divider rounded-2xl px-4 py-5 text-center">
              No recent Mercury payments yet.{" "}
              <button
                type="button"
                onClick={onSwitchToManual}
                className="text-accent underline-offset-2 hover:underline"
              >
                Type it in instead
              </button>
              .
            </div>
          )}
        </div>
      ) : (
        <PaymentSummaryCard tx={picked} address={enrichedAddress} onChange={clearPick} />
      )}

      {/* Step 2: watch reference + AI lookup */}
      {picked ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-muted">Watch reference number</div>
          <div className="flex gap-2 items-center">
            <input
              ref={refInputRef}
              type="text"
              value={refNum}
              onChange={(e) => setRefNum(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void lookupWatch();
                }
              }}
              placeholder="e.g. 126610LN"
              className="flex-1 bg-white border border-divider rounded-2xl px-4 py-3.5 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors"
            />
            <button
              type="button"
              onClick={lookupWatch}
              disabled={looking || !refNum.trim()}
              className="bg-accent hover:bg-accent-deep text-white font-medium text-sm px-4 py-3.5 rounded-2xl disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={16} />
              {looking ? "…" : "Look up"}
            </button>
          </div>
          {brand && model ? (
            <div className="bg-white border border-divider rounded-2xl px-4 py-3 flex flex-col gap-1">
              <div className="text-base text-ink font-medium">
                {brand} {model}
                {year ? <span className="text-muted font-normal"> · {year}</span> : null}
              </div>
              {watchSummary ? (
                <div className="text-sm text-muted">{watchSummary}</div>
              ) : null}
              <div className="flex gap-1.5 mt-1.5">
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="flex-1 bg-divider-soft rounded-md px-2 py-1 text-xs text-ink outline-none"
                  aria-label="Brand"
                />
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex-[2] bg-divider-soft rounded-md px-2 py-1 text-xs text-ink outline-none"
                  aria-label="Model"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Step 3: who sold it */}
      {picked && brand && model ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Sold by</span>
          <PillToggle
            value={soldBy}
            options={
              sellers.length > 0
                ? sellers.map((s) => ({ value: s.name, label: s.name }))
                : [
                    { value: "Joe", label: "Joe" },
                    { value: "Jacob", label: "Jacob" },
                  ]
            }
            onChange={setSoldBy}
            size="sm"
            ariaLabel="Sold by"
          />
        </div>
      ) : null}

      {/* Save */}
      {picked && brand && model ? (
        <button
          type="button"
          onClick={save}
          disabled={submitting}
          className="bg-accent hover:bg-accent-deep text-white font-semibold text-base py-4 rounded-2xl disabled:opacity-40 transition-colors shadow-[0_4px_16px_-6px_rgba(0,82,255,0.4)]"
        >
          {submitting ? "Saving…" : `Save receipt for ${formatUSD(Math.round(picked.amount * 100))} →`}
        </button>
      ) : null}

      {error ? (
        <div className="bg-white border border-warn/40 rounded-2xl px-4 py-3 text-sm text-warn">
          {error}
        </div>
      ) : null}

      {/* Manual fallback */}
      <button
        type="button"
        onClick={onSwitchToManual}
        className="self-center text-sm text-muted hover:text-ink flex items-center gap-1.5"
      >
        <Pencil size={13} /> Type it in instead
      </button>
    </div>
  );
}

function PaymentSummaryCard({
  tx,
  address,
  onChange,
}: {
  tx: MercuryTx;
  address: string;
  onChange: () => void;
}) {
  const name = tx.counterpartyName ?? tx.counterpartyNickname ?? "Unknown";
  const date = new Date(tx.postedAt ?? tx.createdAt);
  const method = tx.kind.toLowerCase().includes("wire")
    ? "Wire"
    : tx.kind === "checkDeposit"
      ? "Check"
      : "ACH";
  return (
    <div className="bg-gradient-to-br from-accent to-accent-deep text-white rounded-2xl p-5 shadow-[0_8px_24px_-8px_rgba(0,82,255,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-80">
            {date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" · "}
            {method}
            {" · "}
            {tx.accountName}
          </div>
          <div className="text-2xl font-bold tracking-tight nums mt-1">
            {formatUSD(Math.round(tx.amount * 100))}
          </div>
          <div className="text-base mt-1 opacity-95">{name}</div>
          {address ? (
            <div className="text-xs opacity-80 mt-1.5 whitespace-pre-line">{address}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onChange}
          className="shrink-0 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
        >
          <X size={12} /> Change
        </button>
      </div>
    </div>
  );
}
