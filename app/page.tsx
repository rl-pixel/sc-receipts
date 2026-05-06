"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { QuickReceipt } from "@/components/QuickReceipt";
import { MercuryRecent, type MercuryTx } from "@/components/MercuryRecent";
import { Textarea, LineInput } from "@/components/Field";
import { PillToggle } from "@/components/PillToggle";
import {
  emptyForm,
  loadForm,
  saveForm,
  clearForm,
} from "@/lib/form-state";
import {
  CONDITIONS,
  PAYMENT_METHODS,
  type FormState,
  type RecentCustomer,
} from "@/lib/types";
import { dollarsToCents, formatUSD } from "@/lib/money";
import { resolveCommissionCents } from "@/lib/commission";

type Bank = { id: string; label: string; acceptsZelle: boolean; acceptsWire: boolean };
type Seller = {
  id: string;
  name: string;
  defaultCommissionType: string | null;
  defaultCommissionValue: number | null;
};
type Brand = { name: string; useCount: number };

type Reveals = {
  address: boolean;
  phone: boolean;
  ref: boolean;
  year: boolean;
  serial: boolean;
  confirmation: boolean;
  notes: boolean;
};

const initialReveals: Reveals = {
  address: false,
  phone: false,
  ref: false,
  year: false,
  serial: false,
  confirmation: false,
  notes: false,
};

export default function NewReceiptPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customerMatches, setCustomerMatches] = useState<RecentCustomer[]>([]);
  const [nameFocused, setNameFocused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveals, setReveals] = useState<Reveals>(initialReveals);
  const [mode, setMode] = useState<"quick" | "manual">("quick");

  useEffect(() => {
    const saved = loadForm();
    if (saved) {
      setForm(saved);
      setReveals({
        address: !!saved.customer.addressLines || !!saved.customer.street,
        phone: !!saved.customer.phone,
        ref: !!saved.watch.referenceNumber,
        year: !!saved.watch.year,
        serial: !!saved.watch.serial,
        confirmation: !!saved.payment.confirmation,
        notes: !!saved.notes,
      });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveForm(form);
  }, [form, hydrated]);

  // Typeahead search: when the user types a name, look up matching past customers.
  useEffect(() => {
    const q = form.customer.name.trim();
    if (q.length < 2) {
      setCustomerMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: RecentCustomer[] = await res.json();
        // hide if the only match is exactly what's already filled in
        const exact = data.length === 1 &&
          data[0].name.toLowerCase() === q.toLowerCase() &&
          data[0].email.toLowerCase() === form.customer.email.toLowerCase();
        setCustomerMatches(exact ? [] : data);
      } catch {
        setCustomerMatches([]);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [form.customer.name, form.customer.email]);

  useEffect(() => {
    const fetchSafe = async <T,>(url: string, fallback: T): Promise<T> => {
      try {
        const r = await fetch(url);
        if (!r.ok) return fallback;
        return (await r.json()) as T;
      } catch {
        return fallback;
      }
    };
    void Promise.all([
      fetchSafe<Bank[]>("/api/banks", []),
      fetchSafe<Seller[]>("/api/sellers", []),
      fetchSafe<Brand[]>("/api/brands", []),
    ]).then(([b, s, br]) => {
      setBanks(b);
      setSellers(s);
      setBrands(br);
      setForm((f) =>
        !f.payment.bankAccountId && b.length
          ? { ...f, payment: { ...f.payment, bankAccountId: b[0].id } }
          : f,
      );
    });
  }, []);

  // AI: extract payment + customer from Mercury PDF/screenshot
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  async function extractFromFile(file: File) {
    setExtracting(true);
    setExtractMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const dataBase64 = dataUrl.split(",")[1] ?? "";
      const res = await fetch("/api/extract-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: file.type || "application/pdf", dataBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");

      // Apply extracted fields
      setForm((f) => {
        const next = { ...f, customer: { ...f.customer }, payment: { ...f.payment } };
        if (data.customer_name) next.customer.name = data.customer_name;
        if (data.customer_email) next.customer.email = data.customer_email;
        if (data.customer_phone) next.customer.phone = data.customer_phone;
        if (data.customer_address) {
          next.customer.addressLines = data.customer_address;
        }
        if (data.amount_usd != null) next.payment.amountUsd = String(data.amount_usd);
        if (data.date_iso) next.payment.date = data.date_iso;
        if (data.confirmation_number) next.payment.confirmation = data.confirmation_number;
        if (data.sender_name) next.payment.sender = data.sender_name;
        const m = data.payment_method;
        if (m === "Zelle" || m === "Wire") next.payment.method = m;
        else if (m === "ACH" || m === "Other") {
          next.payment.method = "Other";
          next.payment.methodOther = m === "ACH" ? "ACH" : "";
        }
        return next;
      });
      setReveals((r) => ({
        ...r,
        address: r.address || !!data.customer_address,
        phone: r.phone || !!data.customer_phone,
        confirmation: r.confirmation || !!data.confirmation_number,
      }));
      setExtractMsg(
        data.confidence === "low"
          ? "Got it — but the screenshot was hard to read. Double-check the fields."
          : "Filled it in. Add the watch + price and you're done.",
      );
    } catch (e) {
      setExtractMsg(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setExtracting(false);
    }
  }

  // Mercury: pick a recent transaction → prefill form (with detail enrichment)
  const [pickedMercuryId, setPickedMercuryId] = useState<string | null>(null);
  async function applyMercuryTx(tx: MercuryTx) {
    setPickedMercuryId(tx.id);
    setForm((f) => {
      const next = { ...f, customer: { ...f.customer }, payment: { ...f.payment } };
      const senderName = tx.counterpartyName ?? tx.counterpartyNickname ?? "";
      if (senderName) {
        next.customer.name = senderName;
        next.payment.sender = senderName;
      }
      next.payment.amountUsd = String(tx.amount);
      const dateStr = (tx.postedAt ?? tx.createdAt).slice(0, 10);
      next.payment.date = dateStr;
      if (tx.kind.toLowerCase().includes("wire")) {
        next.payment.method = "Wire";
      } else if (tx.kind === "checkDeposit") {
        next.payment.method = "Other";
        next.payment.methodOther = "Check";
      } else {
        next.payment.method = "Other";
        next.payment.methodOther = "ACH";
      }
      return next;
    });
    setExtractMsg(`Loaded from Mercury — ${tx.accountName}. Add the watch + price.`);

    // Enrichment: fetch full detail to pull address / sender bank if available
    try {
      const res = await fetch(
        `/api/mercury/transaction?accountId=${encodeURIComponent(tx.accountId)}&id=${encodeURIComponent(tx.id)}`,
      );
      if (!res.ok) return;
      const detail = await res.json();
      const d = detail?.details ?? {};
      // Try common Mercury detail field shapes for address + memo
      const addressParts: string[] = [];
      const wd = d.wireDetails ?? d.wire ?? {};
      const ach = d.achDetails ?? {};
      const orig =
        wd.originator ??
        wd.senderAddress ??
        wd.senderName ??
        d.originator ??
        null;
      if (typeof orig === "string") {
        addressParts.push(orig);
      } else if (orig && typeof orig === "object") {
        for (const k of ["addressLine1", "addressLine2", "city", "state", "zip", "country"]) {
          if (orig[k]) addressParts.push(String(orig[k]));
        }
      }
      const memo: string | undefined =
        d.memo ?? wd.memo ?? ach.memo ?? detail?.externalMemo ?? detail?.note;
      const confirmation: string | undefined =
        wd.imadId ?? wd.imad ?? wd.referenceNumber ?? d.referenceNumber;

      setForm((f) => {
        const next = { ...f, customer: { ...f.customer }, payment: { ...f.payment } };
        if (addressParts.length && !f.customer.addressLines) {
          next.customer.addressLines = addressParts.join("\n");
        }
        if (memo && !f.notes) {
          next.notes = `Mercury memo: ${memo}`;
        }
        if (confirmation && !f.payment.confirmation) {
          next.payment.confirmation = String(confirmation);
        }
        return next;
      });
      if (addressParts.length) setReveals((r) => ({ ...r, address: true }));
      if (confirmation) setReveals((r) => ({ ...r, confirmation: true }));
    } catch {
      // enrichment is best-effort
    }
  }

  // AI: lookup watch by reference number
  const [looking, setLooking] = useState(false);
  async function lookupWatch() {
    const ref = form.watch.referenceNumber.trim();
    if (!ref || looking) return;
    setLooking(true);
    try {
      const res = await fetch("/api/lookup-watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setForm((f) => {
        const next = { ...f, watch: { ...f.watch } };
        if (data.brand) next.watch.brand = data.brand;
        if (data.model) next.watch.model = data.model;
        if (data.year_introduced) next.watch.year = String(data.year_introduced);
        return next;
      });
      if (data.year_introduced) setReveals((r) => ({ ...r, year: true }));
    } finally {
      setLooking(false);
    }
  }

  const subtotalCents = dollarsToCents(form.payment.amountUsd);
  const shippingCents = dollarsToCents(form.totals.shippingUsd);
  const taxCents = dollarsToCents(form.totals.taxUsd);
  const totalCents = subtotalCents + shippingCents + taxCents;

  const commissionAmountCents = useMemo(
    () =>
      resolveCommissionCents(
        form.seller.commissionType,
        form.seller.commissionValue ? Number(form.seller.commissionValue) : null,
        totalCents,
      ),
    [form.seller.commissionType, form.seller.commissionValue, totalCents],
  );

  const customerDone =
    form.customer.email.trim().length > 3 && form.customer.name.trim().length > 0;
  const watchDone =
    form.watch.brand.trim().length > 0 && form.watch.model.trim().length > 0;
  const amountDone = subtotalCents > 0;
  const methodDone =
    !!form.payment.method &&
    (form.payment.method !== "Other" ||
      (!!form.payment.methodOther.trim() && !!form.payment.bankAccountId));
  const allDone = customerDone && watchDone && amountDone && methodDone;

  function patch<K extends keyof FormState>(key: K, value: Partial<FormState[K]>) {
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), ...value } }));
  }
  function reveal(key: keyof Reveals) {
    setReveals((r) => ({ ...r, [key]: true }));
  }

  const zelleBank = useMemo(() => banks.find((b) => b.acceptsZelle), [banks]);
  const wireBank = useMemo(
    () =>
      banks.find((b) => b.acceptsWire && !b.acceptsZelle) ??
      banks.find((b) => b.acceptsWire),
    [banks],
  );

  function selectMethod(m: "Zelle" | "Wire" | "Other") {
    setForm((f) => {
      const nextBankId =
        m === "Zelle"
          ? zelleBank?.id ?? f.payment.bankAccountId
          : m === "Wire"
            ? wireBank?.id ?? f.payment.bankAccountId
            : f.payment.bankAccountId;
      return { ...f, payment: { ...f.payment, method: m, bankAccountId: nextBankId } };
    });
  }

  const linkedBank = banks.find((b) => b.id === form.payment.bankAccountId);

  function applyCustomerChip(c: RecentCustomer) {
    const addr = [c.street, [c.city, c.state].filter(Boolean).join(", "), c.zip]
      .filter(Boolean)
      .join("\n");
    patch("customer", {
      name: c.name,
      email: c.email,
      addressLines: addr,
      street: c.street ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zip: c.zip ?? "",
    });
    if (addr) setReveals((r) => ({ ...r, address: true }));
  }

  function selectSeller(name: string) {
    const s = sellers.find((x) => x.name === name);
    setForm((f) => {
      const next: FormState = { ...f, seller: { ...f.seller, soldBy: name } };
      const blank = !f.seller.commissionType && !f.seller.commissionValue;
      if (s && blank) {
        next.seller.commissionType =
          (s.defaultCommissionType as "percent" | "flat" | null) ?? null;
        next.seller.commissionValue =
          s.defaultCommissionValue != null ? String(s.defaultCommissionValue) : "";
      }
      return next;
    });
  }

  async function submit() {
    if (!allDone || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form: prepareForSubmit(form) }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to create receipt");
      const created = await res.json();
      clearForm();
      router.push(`/history/${created.id}?just_created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full pb-44 sm:pb-32">
      <TopNav active="new" />
      <main className="max-w-2xl mx-auto px-4 pt-6">
        {mode === "quick" ? (
          <QuickReceipt onSwitchToManual={() => setMode("manual")} />
        ) : null}

        {mode === "manual" ? (
        <>
        <MercuryRecent onPick={applyMercuryTx} selectedId={pickedMercuryId} />

        <div className="mt-5">
          <label
            className={`block cursor-pointer rounded-2xl border-2 border-dashed px-5 py-5 text-center transition-colors ${
              extracting
                ? "border-accent bg-accent-soft"
                : "border-divider hover:border-accent hover:bg-accent-soft/50"
            }`}
          >
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) extractFromFile(f);
                e.target.value = "";
              }}
              disabled={extracting}
            />
            {extracting ? (
              <div className="text-sm text-accent font-medium">Reading… one sec</div>
            ) : (
              <>
                <div className="text-base text-ink font-medium">📎 Drop or pick a file</div>
                <div className="text-xs text-muted mt-1">
                  Mercury invoice, wire confirmation, Zelle screenshot — any of them.
                </div>
              </>
            )}
          </label>
          {extractMsg ? (
            <p className="mt-2 text-sm text-success">{extractMsg}</p>
          ) : null}
        </div>

        <div className="mt-7 card-lift divide-y divide-divider">
          <Sec title="Customer" done={customerDone}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="relative">
                <LineInput
                  placeholder="Name"
                  value={form.customer.name}
                  onChange={(e) => patch("customer", { name: e.target.value })}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                />
                {nameFocused &&
                customerMatches.length > 0 &&
                form.customer.name.trim().length >= 2 ? (
                  <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-divider rounded-lg shadow-lg overflow-hidden divide-y divide-divider">
                    {customerMatches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            applyCustomerChip(c);
                            setCustomerMatches([]);
                            setNameFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-divider-soft transition-colors"
                        >
                          <div className="text-sm text-ink">{c.name}</div>
                          <div className="text-xs text-muted truncate">{c.email}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <LineInput
                type="email"
                inputMode="email"
                placeholder="Email"
                value={form.customer.email}
                onChange={(e) => patch("customer", { email: e.target.value })}
              />
            </div>
            {reveals.address ? (
              <Textarea
                rows={3}
                placeholder={"123 Main St\nBrooklyn, NY 11201"}
                value={form.customer.addressLines}
                onChange={(e) => patch("customer", { addressLines: e.target.value })}
              />
            ) : null}
            {reveals.phone ? (
              <LineInput
                type="tel"
                inputMode="tel"
                placeholder="Phone"
                value={form.customer.phone}
                onChange={(e) => patch("customer", { phone: e.target.value })}
              />
            ) : null}
            <RevealRow>
              {!reveals.address && (
                <RevealChip onClick={() => reveal("address")}>Address</RevealChip>
              )}
              {!reveals.phone && (
                <RevealChip onClick={() => reveal("phone")}>Phone</RevealChip>
              )}
            </RevealRow>
          </Sec>

          <Sec title="Watch" done={watchDone}>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <LineInput
                  placeholder="Reference # (e.g. 126610LN)"
                  value={form.watch.referenceNumber}
                  onChange={(e) =>
                    patch("watch", { referenceNumber: e.target.value })
                  }
                />
              </div>
              <button
                type="button"
                onClick={lookupWatch}
                disabled={looking || !form.watch.referenceNumber.trim()}
                className="bg-accent hover:bg-accent-deep text-white text-sm px-4 py-2 rounded-full disabled:opacity-40 transition-colors shrink-0"
              >
                {looking ? "…" : "✨ Look up"}
              </button>
            </div>
            <Row2>
              <LineInput
                placeholder="Brand"
                list="brand-suggestions"
                value={form.watch.brand}
                onChange={(e) => patch("watch", { brand: e.target.value })}
              />
              <LineInput
                placeholder="Model"
                value={form.watch.model}
                onChange={(e) => patch("watch", { model: e.target.value })}
              />
            </Row2>
            <datalist id="brand-suggestions">
              {brands.map((b) => (
                <option key={b.name} value={b.name} />
              ))}
            </datalist>
            <div className="flex items-center gap-6 pt-1">
              <CheckRow
                label="Box"
                checked={form.watch.hasBox}
                onChange={(v) => patch("watch", { hasBox: v })}
              />
              <CheckRow
                label="Papers"
                checked={form.watch.hasPapers}
                onChange={(v) => patch("watch", { hasPapers: v })}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Condition</span>
              <PillToggle
                value={form.watch.condition}
                options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                onChange={(v) => patch("watch", { condition: v })}
                size="sm"
                ariaLabel="Condition"
              />
            </div>
            {reveals.year ? (
              <LineInput
                inputMode="numeric"
                placeholder="Year"
                value={form.watch.year}
                onChange={(e) => patch("watch", { year: e.target.value })}
              />
            ) : null}
            {reveals.serial ? (
              <LineInput
                placeholder="Serial"
                value={form.watch.serial}
                onChange={(e) => patch("watch", { serial: e.target.value })}
              />
            ) : null}
            <RevealRow>
              {!reveals.year && <RevealChip onClick={() => reveal("year")}>Year</RevealChip>}
              {!reveals.serial && <RevealChip onClick={() => reveal("serial")}>Serial</RevealChip>}
            </RevealRow>
          </Sec>

          <Sec title="Amount paid" done={amountDone}>
            <LineInput
              prefix="$"
              inputMode="decimal"
              placeholder="0.00"
              value={form.payment.amountUsd}
              onChange={(e) => patch("payment", { amountUsd: e.target.value })}
              className="text-2xl"
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              Date
              <input
                type="date"
                value={form.payment.date}
                onChange={(e) => patch("payment", { date: e.target.value })}
                className="bg-white border border-divider rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft nums"
                aria-label="Date received"
              />
            </label>
          </Sec>

          <Sec title="How they paid" done={methodDone}>
            <PillToggle
              value={form.payment.method}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
              onChange={selectMethod}
              size="sm"
              ariaLabel="Payment method"
            />
            {form.payment.method === "Other" ? (
              <>
                <LineInput
                  placeholder="Cash, Venmo, Check…"
                  value={form.payment.methodOther}
                  onChange={(e) => patch("payment", { methodOther: e.target.value })}
                />
                {banks.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted">Into</span>
                    <PillToggle
                      value={form.payment.bankAccountId}
                      options={banks.map((b) => ({ value: b.id, label: b.label }))}
                      onChange={(id) => patch("payment", { bankAccountId: id })}
                      size="sm"
                      ariaLabel="Bank account"
                    />
                  </div>
                ) : null}
              </>
            ) : linkedBank ? (
              <div className="text-sm text-muted">
                Into <span className="text-ink">{linkedBank.label}</span>
              </div>
            ) : null}
            {reveals.confirmation ? (
              <LineInput
                placeholder="Confirmation #"
                value={form.payment.confirmation}
                onChange={(e) => patch("payment", { confirmation: e.target.value })}
              />
            ) : null}
            <RevealRow>
              {!reveals.confirmation && (
                <RevealChip onClick={() => reveal("confirmation")}>Confirmation #</RevealChip>
              )}
            </RevealRow>
          </Sec>

          <Sec title="Sold by">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {sellers.length > 0 ? (
                <PillToggle
                  value={form.seller.soldBy}
                  options={sellers.map((s) => ({ value: s.name, label: s.name }))}
                  onChange={selectSeller}
                  size="sm"
                  ariaLabel="Sold by"
                />
              ) : null}
              <PillToggle
                value={form.seller.commissionType ?? "none"}
                options={[
                  { value: "none", label: "No commission" },
                  { value: "percent", label: "%" },
                  { value: "flat", label: "$" },
                ]}
                onChange={(v) =>
                  patch("seller", {
                    commissionType: v === "none" ? null : (v as "percent" | "flat"),
                    commissionValue: v === "none" ? "" : form.seller.commissionValue,
                  })
                }
                size="sm"
                ariaLabel="Commission type"
              />
              {form.seller.commissionType ? (
                <input
                  inputMode="decimal"
                  placeholder={form.seller.commissionType === "percent" ? "10" : "200"}
                  value={form.seller.commissionValue}
                  onChange={(e) => patch("seller", { commissionValue: e.target.value })}
                  className="w-20 bg-white border border-divider rounded-md px-2 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                />
              ) : null}
              {commissionAmountCents != null && commissionAmountCents > 0 ? (
                <span className="text-xs text-success nums">
                  = {formatUSD(commissionAmountCents)}
                </span>
              ) : null}
            </div>
          </Sec>

          <Sec title="Receipt totals">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <SmallNumberField
                label="Shipping"
                prefix="$"
                placeholder="29"
                value={form.totals.shippingUsd}
                onChange={(v) => patch("totals", { shippingUsd: v })}
              />
              <SmallNumberField
                label="Tax"
                prefix="$"
                placeholder="0"
                value={form.totals.taxUsd}
                onChange={(v) => patch("totals", { taxUsd: v })}
              />
            </div>
            {reveals.notes ? (
              <Textarea
                rows={2}
                placeholder="Internal notes (private — not on receipt)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            ) : (
              <RevealRow>
                <RevealChip onClick={() => reveal("notes")}>Internal notes</RevealChip>
              </RevealRow>
            )}
          </Sec>
        </div>

        {error ? (
          <div className="mt-5 p-4 rounded-lg bg-white border border-warn/40 text-warn text-sm">
            {error}
          </div>
        ) : null}
        </>
        ) : null}
      </main>

      {mode === "manual" ? (
      <div className="fixed bottom-[64px] sm:bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-divider">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 nums">
            <div className="text-xs text-muted">Total</div>
            <div className="text-xl font-semibold text-ink leading-tight">
              {formatUSD(totalCents)}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!allDone || submitting}
            className="bg-accent hover:bg-accent-deep text-white font-semibold text-base py-3.5 px-7 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? "Saving…" : "Save receipt →"}
          </button>
        </div>
      </div>
      ) : null}

      <BottomNav active="new" />
    </div>
  );
}

function prepareForSubmit(form: FormState): FormState {
  const next = { ...form, payment: { ...form.payment } };
  if (form.customer.addressLines && !form.customer.street) {
    next.customer = { ...next.customer, street: form.customer.addressLines };
  }
  if (!form.payment.sender && form.customer.name) {
    next.payment.sender = form.customer.name;
  }
  if (form.payment.method === "Other" && form.payment.methodOther.trim()) {
    next.payment.method = form.payment.methodOther.trim() as FormState["payment"]["method"];
  }
  return next;
}

function Sec({
  title,
  done,
  children,
}: {
  title: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="px-5 py-5 sm:px-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {done ? <span className="text-success text-base">✓</span> : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">{children}</div>;
}

function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 px-1 overflow-x-auto">
      <div className="flex gap-1.5 pb-1">{children}</div>
    </div>
  );
}

function Chip({
  children,
  onClick,
  selected,
}: {
  children: ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 text-sm px-3 py-1.5 rounded-full border transition-colors ${
        selected
          ? "bg-accent text-white border-accent"
          : "bg-white border-divider text-ink hover:border-accent/50"
      }`}
    >
      {children}
    </button>
  );
}

function RevealRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">{children}</div>;
}

function RevealChip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-accent hover:text-accent-deep transition-colors"
    >
      + {children}
    </button>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-base cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-accent"
      />
      <span className="text-ink">{label}</span>
    </label>
  );
}

function SmallNumberField({
  label,
  prefix,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  prefix?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <div className="flex items-center gap-1 bg-white border border-divider rounded-md px-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft transition-colors">
        {prefix ? <span className="text-muted-soft text-sm">{prefix}</span> : null}
        <input
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 bg-transparent py-1.5 text-sm text-ink outline-none nums"
        />
      </div>
    </label>
  );
}
