"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Search, X, Pencil, Sparkles, Paperclip, FileText } from "lucide-react";
import type { MercuryTx } from "@/components/MercuryRecent";
import type { MercuryInvoice } from "@/app/api/mercury/invoices/route";
import { PillToggle } from "@/components/PillToggle";
import { formatUSD } from "@/lib/money";

type Seller = { id: string; name: string };
type Bank = { id: string; label: string; acceptsZelle: boolean; acceptsWire: boolean };

type AppReceipt = {
  id: string;
  receiptNumber: string;
  brand: string;
  model: string;
  totalCents: number;
  createdAt: string;
  customer: { name: string; email: string };
};

type FeedItem =
  | { kind: "money_in"; sortKey: number; tx: MercuryTx }
  | { kind: "money_out"; sortKey: number; tx: MercuryTx }
  | { kind: "invoice_out"; sortKey: number; inv: MercuryInvoice }
  | { kind: "receipt"; sortKey: number; r: AppReceipt };

export function QuickReceipt({ onSwitchToManual }: { onSwitchToManual: () => void }) {
  const router = useRouter();

  // Mercury data + app receipts
  const [txs, setTxs] = useState<MercuryTx[]>([]);
  const [invoices, setInvoices] = useState<MercuryInvoice[]>([]);
  const [appReceipts, setAppReceipts] = useState<AppReceipt[]>([]);
  const [picked, setPicked] = useState<MercuryTx | null>(null);
  const [pickedInvoice, setPickedInvoice] = useState<MercuryInvoice | null>(null);

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

  // Screenshot extraction (Gemini)
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [extractedFromShot, setExtractedFromShot] = useState<{
    customerName: string;
    customerEmail?: string;
    customerAddress?: string;
    amount: number;
    date?: string;
    method?: string;
  } | null>(null);

  const refInputRef = useRef<HTMLInputElement>(null);

  // Initial load: Mercury txs + invoices + app receipts + sellers + banks
  useEffect(() => {
    void (async () => {
      const [tx, inv, rec, s, b] = await Promise.all([
        fetch("/api/mercury/recent")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch("/api/mercury/invoices")
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch("/api/receipts")
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
      setInvoices(Array.isArray(inv) ? inv : []);
      setAppReceipts(Array.isArray(rec) ? rec : []);
      setSellers(s);
      setBanks(b);
    })();
  }, []);

  async function handleScreenshot(file: File) {
    setExtracting(true);
    setExtractMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const dataBase64 = dataUrl.split(",")[1] ?? "";
      const res = await fetch("/api/extract-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mimeType: file.type || "application/pdf",
          dataBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      const customerName = data.customer_name || data.sender_name || "";
      const amount = Number(data.amount_usd) || 0;
      if (!customerName || !amount) {
        setExtractMsg(
          "Couldn't read customer name + amount from that. Try a clearer image or type it in.",
        );
        return;
      }
      setExtractedFromShot({
        customerName,
        customerEmail: data.customer_email ?? undefined,
        customerAddress: data.customer_address ?? undefined,
        amount,
        date: data.date_iso ?? undefined,
        method: data.payment_method ?? undefined,
      });
      // Clear any picked Mercury tx
      setPicked(null);
      setExtractMsg(`Pulled ${customerName} · ${formatUSD(Math.round(amount * 100))}.`);
      setTimeout(() => refInputRef.current?.focus(), 50);
    } catch (e) {
      setExtractMsg(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setExtracting(false);
    }
  }

  // Build the unified feed — money in, money out, invoices out, receipts —
  // sorted newest first, then filter by the search query.
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const t of txs) {
      const sortKey = new Date(t.postedAt ?? t.createdAt).getTime();
      items.push({ kind: t.amount >= 0 ? "money_in" : "money_out", sortKey, tx: t });
    }
    for (const i of invoices) {
      const sortKey = new Date(i.updatedAt).getTime();
      items.push({ kind: "invoice_out", sortKey, inv: i });
    }
    for (const r of appReceipts) {
      const sortKey = new Date(r.createdAt).getTime();
      items.push({ kind: "receipt", sortKey, r });
    }
    items.sort((a, b) => b.sortKey - a.sortKey);
    return items;
  }, [txs, invoices, appReceipts]);

  const filteredFeed = useMemo<FeedItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed.slice(0, 14);
    const numQ = Number(q.replace(/[$,]/g, ""));
    const isNum = !Number.isNaN(numQ) && numQ > 0;
    return feed
      .filter((item) => {
        let name = "";
        let amount = 0;
        if (item.kind === "money_in" || item.kind === "money_out") {
          name = (item.tx.counterpartyName ?? item.tx.counterpartyNickname ?? "").toLowerCase();
          amount = Math.abs(item.tx.amount);
        } else if (item.kind === "invoice_out") {
          name = (item.inv.recipient.name ?? item.inv.recipient.email ?? "").toLowerCase();
          amount = item.inv.amount;
        } else {
          name = (item.r.customer.name ?? "").toLowerCase();
          amount = item.r.totalCents / 100;
        }
        if (name.includes(q)) return true;
        if (isNum) {
          const amt = Math.round(amount);
          if (amt === Math.round(numQ)) return true;
          if (String(amt).startsWith(String(Math.round(numQ)))) return true;
        }
        return false;
      })
      .slice(0, 14);
  }, [query, feed]);

  function pickInvoice(inv: MercuryInvoice) {
    setPickedInvoice(inv);
    setPicked(null);
    setExtractedFromShot(null);
    setExtractMsg(null);
    setQuery("");
    setTimeout(() => refInputRef.current?.focus(), 50);
  }

  function pickTx(tx: MercuryTx) {
    setPicked(tx);
    setPickedInvoice(null);
    setExtractedFromShot(null);
    setExtractMsg(null);
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
    setPickedInvoice(null);
    setExtractedFromShot(null);
    setExtractMsg(null);
    setEnrichedAddress("");
    setEnrichedConfirmation("");
    setRefNum("");
    setBrand("");
    setModel("");
    setYear("");
    setWatchSummary(null);
  }

  const hasSelection = !!picked || !!pickedInvoice || !!extractedFromShot;

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
    if (!hasSelection || submitting) return;
    if (!brand.trim() || !model.trim()) {
      setError("Watch brand + model required. Type a reference and tap Look up.");
      return;
    }

    // Build payment data from whichever source was used
    let senderName = "";
    let amountUsd = "";
    let dateStr = new Date().toISOString().slice(0, 10);
    let method: "Zelle" | "Wire" | "Other" = "Other";
    let methodOther = "";
    let confirmation = "";
    let customerEmail = "";
    let customerAddress = "";

    if (picked) {
      senderName = picked.counterpartyName ?? picked.counterpartyNickname ?? "";
      amountUsd = String(picked.amount);
      dateStr = (picked.postedAt ?? picked.createdAt).slice(0, 10);
      method = picked.kind.toLowerCase().includes("wire") ? "Wire" : "Other";
      methodOther =
        method === "Other"
          ? picked.kind === "checkDeposit"
            ? "Check"
            : "ACH"
          : "";
      confirmation = enrichedConfirmation;
      customerAddress = enrichedAddress;
    } else if (pickedInvoice) {
      senderName = pickedInvoice.recipient.name ?? "";
      customerEmail = pickedInvoice.recipient.email ?? "";
      amountUsd = String(pickedInvoice.amount);
      dateStr = pickedInvoice.updatedAt.slice(0, 10);
      method = "Other";
      methodOther = "Mercury invoice";
    } else if (extractedFromShot) {
      senderName = extractedFromShot.customerName;
      amountUsd = String(extractedFromShot.amount);
      dateStr = extractedFromShot.date ?? dateStr;
      const m = extractedFromShot.method;
      if (m === "Zelle") method = "Zelle";
      else if (m === "Wire") method = "Wire";
      else if (m === "ACH") {
        method = "Other";
        methodOther = "ACH";
      } else if (m === "Other" || m) {
        method = "Other";
        methodOther = m === "Other" ? "" : m;
      }
      customerEmail = extractedFromShot.customerEmail ?? "";
      customerAddress = extractedFromShot.customerAddress ?? "";
    }

    const bankId =
      method === "Wire"
        ? banks.find((b) => b.acceptsWire && !b.acceptsZelle)?.id ??
          banks[0]?.id ??
          ""
        : method === "Zelle"
          ? banks.find((b) => b.acceptsZelle)?.id ?? banks[0]?.id ?? ""
          : banks[0]?.id ?? "";

    setSubmitting(true);
    setError(null);
    try {
      const formPayload = {
        payment: {
          sender: senderName,
          amountUsd,
          date: dateStr,
          confirmation,
          method,
          methodOther,
          bankAccountId: bankId,
        },
        customer: {
          name: senderName,
          email: customerEmail,
          phone: "",
          addressLines: customerAddress,
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
        seller: { soldBy, commissionType: null, commissionValue: "" },
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
      {/* Step 1: pick a Mercury payment OR drop a screenshot */}
      {!hasSelection ? (
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

          {filteredFeed.length > 0 ? (
            <ul className="bg-white border border-divider rounded-2xl divide-y divide-divider overflow-hidden">
              {filteredFeed.map((item) => (
                <FeedRow
                  key={
                    item.kind === "money_in" || item.kind === "money_out"
                      ? `tx-${item.tx.id}`
                      : item.kind === "invoice_out"
                        ? `inv-${item.inv.id}`
                        : `r-${item.r.id}`
                  }
                  item={item}
                  onPickTx={pickTx}
                  onPickInvoice={pickInvoice}
                  onOpenReceipt={(id) => router.push(`/history/${id}`)}
                />
              ))}
            </ul>
          ) : query.trim() ? (
            <div className="text-sm text-muted bg-white border border-divider rounded-2xl px-4 py-3">
              Nothing matches.{" "}
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
              No recent activity.{" "}
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

          {/* Screenshot fallback for Chase Zelle / Mercury invoices / anything else */}
          <div>
            <label
              className={`block cursor-pointer rounded-2xl border-2 border-dashed px-4 py-4 transition-colors ${
                extracting
                  ? "border-accent bg-accent-soft"
                  : "border-divider hover:border-accent hover:bg-accent-soft/40"
              }`}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScreenshot(f);
                  e.target.value = "";
                }}
                disabled={extracting}
              />
              <div className="flex items-center gap-3">
                <Paperclip
                  size={18}
                  className={extracting ? "text-accent" : "text-muted"}
                />
                <div className="flex-1">
                  {extracting ? (
                    <div className="text-sm text-accent font-medium">Reading…</div>
                  ) : (
                    <>
                      <div className="text-sm text-ink font-medium">
                        Or drop a screenshot
                      </div>
                      <div className="text-xs text-muted">
                        Mercury invoice, Chase Zelle, wire confirmation — Gemini reads it.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </label>
            {extractMsg ? (
              <p className="mt-2 text-xs text-muted">{extractMsg}</p>
            ) : null}
          </div>
        </div>
      ) : picked ? (
        <PaymentSummaryCard tx={picked} address={enrichedAddress} onChange={clearPick} />
      ) : pickedInvoice ? (
        <InvoiceSummaryCard inv={pickedInvoice} onChange={clearPick} />
      ) : extractedFromShot ? (
        <ExtractedSummaryCard
          customerName={extractedFromShot.customerName}
          amount={extractedFromShot.amount}
          date={extractedFromShot.date}
          method={extractedFromShot.method}
          address={extractedFromShot.customerAddress}
          onChange={clearPick}
        />
      ) : null}

      {/* Step 2: watch reference + AI lookup */}
      {hasSelection ? (
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
      {hasSelection && brand && model ? (
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
      {hasSelection && brand && model ? (
        <button
          type="button"
          onClick={save}
          disabled={submitting}
          className="bg-accent hover:bg-accent-deep text-white font-semibold text-base py-4 rounded-2xl disabled:opacity-40 transition-colors shadow-[0_4px_16px_-6px_rgba(0,82,255,0.4)]"
        >
          {submitting
            ? "Saving…"
            : `Save receipt for ${formatUSD(
                Math.round(
                  (picked?.amount ??
                    pickedInvoice?.amount ??
                    extractedFromShot?.amount ??
                    0) * 100,
                ),
              )} →`}
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

function FeedRow({
  item,
  onPickTx,
  onPickInvoice,
  onOpenReceipt,
}: {
  item: FeedItem;
  onPickTx: (t: MercuryTx) => void;
  onPickInvoice: (i: MercuryInvoice) => void;
  onOpenReceipt: (id: string) => void;
}) {
  let label = "";
  let pillClass = "";
  let name = "";
  let amount = 0;
  let date = new Date();
  let meta = "";
  let onClick: (() => void) | null = null;
  let amountClass = "text-ink";

  if (item.kind === "money_in") {
    label = "Money in";
    pillClass = "bg-success-soft text-success-deep";
    const t = item.tx;
    name = t.counterpartyName ?? t.counterpartyNickname ?? "Unknown";
    amount = Math.abs(t.amount);
    date = new Date(t.postedAt ?? t.createdAt);
    meta = t.kind.toLowerCase().includes("wire")
      ? "Wire"
      : t.kind === "checkDeposit"
        ? "Check"
        : "ACH";
    onClick = () => onPickTx(t);
    amountClass = "text-success-deep";
  } else if (item.kind === "money_out") {
    label = "Money out";
    pillClass = "bg-divider-soft text-muted";
    const t = item.tx;
    name = t.counterpartyName ?? t.counterpartyNickname ?? "Unknown";
    amount = Math.abs(t.amount);
    date = new Date(t.postedAt ?? t.createdAt);
    meta = t.kind.toLowerCase().includes("wire") ? "Wire" : "Payment";
    amountClass = "text-muted";
    // not actionable for receipts — no onClick
  } else if (item.kind === "invoice_out") {
    label = "Invoice out";
    pillClass = "bg-accent-soft text-accent-deep";
    const inv = item.inv;
    name = inv.recipient.name ?? inv.recipient.email ?? "Unknown";
    amount = inv.amount;
    date = new Date(inv.updatedAt);
    meta = inv.status;
    onClick = () => onPickInvoice(inv);
  } else {
    label = "Receipt";
    pillClass = "bg-gold-soft text-amber-700";
    const r = item.r;
    name = r.customer.name;
    amount = r.totalCents / 100;
    date = new Date(r.createdAt);
    meta = `${r.brand} ${r.model}`.trim() || r.receiptNumber;
    onClick = () => onOpenReceipt(r.id);
  }

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const inner = (
    <>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${pillClass}`}
      >
        {label}
      </span>
      <div className="min-w-0">
        <div className="text-base text-ink truncate">{name}</div>
        <div className="text-xs text-muted truncate">
          {dateStr} · {meta}
        </div>
      </div>
      <div className={`text-base font-semibold nums shrink-0 ${amountClass}`}>
        {item.kind === "money_out" ? "−" : ""}
        {formatUSD(Math.round(amount * 100))}
      </div>
    </>
  );

  if (!onClick) {
    return (
      <li className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 opacity-70">
        {inner}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 text-left hover:bg-divider-soft active:bg-accent-soft transition-colors"
      >
        {inner}
      </button>
    </li>
  );
}

function InvoiceSummaryCard({
  inv,
  onChange,
}: {
  inv: MercuryInvoice;
  onChange: () => void;
}) {
  const name = inv.recipient.name ?? inv.recipient.email ?? "Unknown";
  const date = new Date(inv.updatedAt);
  return (
    <div className="bg-gradient-to-br from-accent to-accent-deep text-white rounded-2xl p-5 shadow-[0_8px_24px_-8px_rgba(0,82,255,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-80 flex items-center gap-1.5">
            <FileText size={11} />
            Mercury invoice ·{" "}
            {date.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {inv.status}
          </div>
          <div className="text-2xl font-bold tracking-tight nums mt-1">
            {formatUSD(Math.round(inv.amount * 100))}
          </div>
          <div className="text-base mt-1 opacity-95">{name}</div>
          {inv.recipient.email && inv.recipient.name ? (
            <div className="text-xs opacity-80 mt-0.5">{inv.recipient.email}</div>
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

function ExtractedSummaryCard({
  customerName,
  amount,
  date,
  method,
  address,
  onChange,
}: {
  customerName: string;
  amount: number;
  date?: string;
  method?: string;
  address?: string;
  onChange: () => void;
}) {
  const d = date ? new Date(date) : new Date();
  return (
    <div className="bg-gradient-to-br from-accent to-accent-deep text-white rounded-2xl p-5 shadow-[0_8px_24px_-8px_rgba(0,82,255,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-80">
            {d.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {method ? ` · ${method}` : ""} · From screenshot
          </div>
          <div className="text-2xl font-bold tracking-tight nums mt-1">
            {formatUSD(Math.round(amount * 100))}
          </div>
          <div className="text-base mt-1 opacity-95">{customerName}</div>
          {address ? (
            <div className="text-xs opacity-80 mt-1.5 whitespace-pre-line">
              {address}
            </div>
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
