"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Section } from "@/components/Section";
import { Field, Textarea } from "@/components/Field";
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
  type RecentWatch,
} from "@/lib/types";
import { dollarsToCents, formatUSD } from "@/lib/money";
import { resolveCommissionCents } from "@/lib/commission";

type Bank = { id: string; label: string };
type Seller = {
  id: string;
  name: string;
  defaultCommissionType: string | null;
  defaultCommissionValue: number | null;
};
type Brand = { name: string; useCount: number };

export default function NewReceiptPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [recentWatches, setRecentWatches] = useState<RecentWatch[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const saved = loadForm();
    if (saved) setForm(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveForm(form);
  }, [form, hydrated]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/banks").then((r) => r.json()),
      fetch("/api/sellers").then((r) => r.json()),
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/recent").then((r) => r.json()),
    ]).then(([b, s, br, recent]) => {
      setBanks(b);
      setSellers(s);
      setBrands(br);
      setRecentWatches(recent.watches ?? []);
      setRecentCustomers(recent.customers ?? []);
      setForm((f) => {
        if (!f.payment.bankAccountId && b.length) {
          return { ...f, payment: { ...f.payment, bankAccountId: b[0].id } };
        }
        return f;
      });
    });
  }, []);

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

  const canSubmit =
    form.customer.email.trim().length > 3 &&
    form.customer.name.trim().length > 0 &&
    form.watch.brand.trim().length > 0 &&
    form.watch.model.trim().length > 0 &&
    subtotalCents > 0;

  function patch<K extends keyof FormState>(key: K, value: Partial<FormState[K]>) {
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), ...value } }));
  }

  function applyWatchCard(w: RecentWatch) {
    patch("watch", {
      brand: w.brand,
      model: w.model,
      referenceNumber: w.referenceNumber ?? "",
      year: w.year != null ? String(w.year) : "",
      hasBox: w.hasBox,
      hasPapers: w.hasPapers,
    });
  }

  function applyCustomerChip(c: RecentCustomer) {
    patch("customer", {
      name: c.name,
      email: c.email,
      addressLines: [c.street, [c.city, c.state].filter(Boolean).join(", "), c.zip]
        .filter(Boolean)
        .join("\n"),
      street: c.street ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      zip: c.zip ?? "",
    });
  }

  function selectSeller(name: string) {
    const s = sellers.find((x) => x.name === name);
    setForm((f) => {
      const next: FormState = { ...f, seller: { ...f.seller, soldBy: name } };
      const blankCommission = !f.seller.commissionType && !f.seller.commissionValue;
      if (s && blankCommission) {
        next.seller.commissionType =
          (s.defaultCommissionType as "percent" | "flat" | null) ?? null;
        next.seller.commissionValue =
          s.defaultCommissionValue != null ? String(s.defaultCommissionValue) : "";
      }
      return next;
    });
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ form: collapseAddress(form) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create receipt");
      }
      const created = await res.json();
      clearForm();
      router.push(`/history/${created.id}?just_created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full pb-32">
      <TopNav active="new" />
      <main className="max-w-2xl mx-auto px-4 pt-8">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
            New receipt
          </h1>
          <p className="text-sm text-muted">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>

        <DropZonePlaceholder />

        {recentWatches.length > 0 ? (
          <RecentWatches watches={recentWatches} onPick={applyWatchCard} active={form.watch} />
        ) : null}

        {recentCustomers.length > 0 ? (
          <RecentCustomers
            customers={recentCustomers}
            onPick={applyCustomerChip}
            activeEmail={form.customer.email}
          />
        ) : null}

        <div className="mt-6 bg-white border border-divider rounded-2xl p-5 flex flex-col gap-5">
          <Section>
            <Field
              label="Amount paid"
              prefix="$"
              size="lg"
              inputMode="decimal"
              placeholder="0.00"
              value={form.payment.amountUsd}
              onChange={(e) => patch("payment", { amountUsd: e.target.value })}
            />
          </Section>

          <Section title="Customer">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Email"
                type="email"
                inputMode="email"
                placeholder="brian@email.com"
                value={form.customer.email}
                onChange={(e) => patch("customer", { email: e.target.value })}
              />
              <Field
                label="Name"
                placeholder="Brian Hodge"
                value={form.customer.name}
                onChange={(e) => patch("customer", { name: e.target.value })}
              />
            </div>
            <Textarea
              label="Ship to"
              rows={3}
              placeholder={"123 Main St\nBrooklyn, NY 11201"}
              value={form.customer.addressLines}
              onChange={(e) => patch("customer", { addressLines: e.target.value })}
            />
          </Section>

          <Section title="Watch">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label="Brand"
                placeholder="Rolex"
                list="brand-suggestions"
                value={form.watch.brand}
                onChange={(e) => patch("watch", { brand: e.target.value })}
              />
              <Field
                label="Model"
                placeholder="Submariner Date"
                value={form.watch.model}
                onChange={(e) => patch("watch", { model: e.target.value })}
              />
            </div>
            <datalist id="brand-suggestions">
              {brands.map((b) => (
                <option key={b.name} value={b.name} />
              ))}
            </datalist>
            <div className="flex gap-6 pt-1">
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
          </Section>

          <Section title="Payment + bank + sold by">
            <div className="flex flex-col gap-3">
              <ToggleRow label="Method">
                <PillToggle
                  value={form.payment.method}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                  onChange={(m) => patch("payment", { method: m })}
                  size="sm"
                  ariaLabel="Payment method"
                />
              </ToggleRow>
              {banks.length > 0 ? (
                <ToggleRow label="Deposited to">
                  <PillToggle
                    value={form.payment.bankAccountId}
                    options={banks.map((b) => ({ value: b.id, label: b.label }))}
                    onChange={(id) => patch("payment", { bankAccountId: id })}
                    size="sm"
                    ariaLabel="Bank account"
                  />
                </ToggleRow>
              ) : null}
              {sellers.length > 0 ? (
                <ToggleRow label="Sold by">
                  <PillToggle
                    value={form.seller.soldBy}
                    options={sellers.map((s) => ({ value: s.name, label: s.name }))}
                    onChange={selectSeller}
                    size="sm"
                    ariaLabel="Sold by"
                  />
                </ToggleRow>
              ) : null}
            </div>
          </Section>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="self-start text-xs uppercase tracking-wider text-accent hover:text-accent-deep transition-colors"
          >
            {showMore ? "− Hide details" : "+ More details"}
          </button>

          {showMore ? (
            <div className="border-t border-divider pt-5 flex flex-col gap-5">
              <Section title="Payment details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Sender"
                    placeholder={form.customer.name || "Auto: customer name"}
                    value={form.payment.sender}
                    onChange={(e) => patch("payment", { sender: e.target.value })}
                  />
                  <Field
                    label="Date received"
                    type="date"
                    value={form.payment.date}
                    onChange={(e) => patch("payment", { date: e.target.value })}
                  />
                  <Field
                    label="Confirmation #"
                    placeholder="BAC1234567"
                    value={form.payment.confirmation}
                    onChange={(e) => patch("payment", { confirmation: e.target.value })}
                  />
                  <Field
                    label="Phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="Optional"
                    value={form.customer.phone}
                    onChange={(e) => patch("customer", { phone: e.target.value })}
                  />
                </div>
              </Section>

              <Section title="Watch details">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field
                    label="Reference #"
                    placeholder="126610LN"
                    value={form.watch.referenceNumber}
                    onChange={(e) => patch("watch", { referenceNumber: e.target.value })}
                  />
                  <Field
                    label="Year"
                    inputMode="numeric"
                    placeholder="2024"
                    value={form.watch.year}
                    onChange={(e) => patch("watch", { year: e.target.value })}
                  />
                  <Field
                    label="Serial"
                    placeholder="Optional"
                    value={form.watch.serial}
                    onChange={(e) => patch("watch", { serial: e.target.value })}
                  />
                </div>
                <ToggleRow label="Condition">
                  <PillToggle
                    value={form.watch.condition}
                    options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                    onChange={(v) => patch("watch", { condition: v })}
                    size="sm"
                    ariaLabel="Condition"
                  />
                </ToggleRow>
              </Section>

              <Section title="Totals">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Shipping"
                    prefix="$"
                    inputMode="decimal"
                    placeholder="29.00"
                    value={form.totals.shippingUsd}
                    onChange={(e) => patch("totals", { shippingUsd: e.target.value })}
                  />
                  <Field
                    label="Tax"
                    prefix="$"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.totals.taxUsd}
                    onChange={(e) => patch("totals", { taxUsd: e.target.value })}
                  />
                </div>
              </Section>

              <Section title="Commission">
                <div className="flex items-end gap-3 flex-wrap">
                  <PillToggle
                    value={form.seller.commissionType ?? "none"}
                    options={[
                      { value: "none", label: "None" },
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
                    <div className="flex-1 min-w-[140px]">
                      <Field
                        label={form.seller.commissionType === "percent" ? "Percent" : "Flat amount"}
                        inputMode="decimal"
                        prefix={form.seller.commissionType === "flat" ? "$" : ""}
                        suffix={form.seller.commissionType === "percent" ? "%" : ""}
                        placeholder={form.seller.commissionType === "percent" ? "10" : "200"}
                        value={form.seller.commissionValue}
                        onChange={(e) => patch("seller", { commissionValue: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
                {commissionAmountCents != null && commissionAmountCents > 0 ? (
                  <p className="text-xs text-muted">
                    {form.seller.soldBy}'s commission:{" "}
                    <span className="text-success">{formatUSD(commissionAmountCents)}</span>
                  </p>
                ) : null}
              </Section>

              <Section title="Notes">
                <Textarea
                  label="Internal notes (not on receipt)"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Section>
            </div>
          ) : null}
        </div>

        <TotalsSummary
          subtotalCents={subtotalCents}
          shippingCents={shippingCents}
          taxCents={taxCents}
          totalCents={totalCents}
        />

        {error ? (
          <div className="mt-4 p-4 rounded-lg bg-white border border-warn/40 text-warn text-sm">
            {error}
          </div>
        ) : null}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-divider">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 nums">
            <div className="text-[10px] uppercase tracking-wider text-muted">Total</div>
            <div className="text-xl font-[family-name:var(--font-display)] text-ink leading-tight">
              {formatUSD(totalCents)}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="bg-accent hover:bg-accent-deep text-white font-medium tracking-wide text-sm py-3 px-6 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save Receipt →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function collapseAddress(form: FormState): FormState {
  if (form.customer.addressLines && !form.customer.street) {
    return {
      ...form,
      customer: { ...form.customer, street: form.customer.addressLines },
    };
  }
  return form;
}

function DropZonePlaceholder() {
  return (
    <div className="mt-6 border-2 border-dashed border-divider rounded-2xl px-6 py-7 text-center bg-white relative">
      <div className="text-2xl mb-1">📸</div>
      <div className="text-sm text-ink font-medium">Drop a Zelle or Wire screenshot</div>
      <div className="text-xs text-muted mt-1">
        Auto-fills sender, amount, date, confirmation #
      </div>
      <div className="absolute top-2 right-3 text-[9px] uppercase tracking-wider text-accent">
        Coming next
      </div>
    </div>
  );
}

function RecentWatches({
  watches,
  onPick,
  active,
}: {
  watches: RecentWatch[];
  onPick: (w: RecentWatch) => void;
  active: { brand: string; model: string; referenceNumber: string };
}) {
  return (
    <div className="mt-6">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
        Sold recently — tap to fill
      </div>
      <div className="-mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {watches.map((w, i) => {
            const selected =
              active.brand === w.brand &&
              active.model === w.model &&
              (active.referenceNumber ?? "") === (w.referenceNumber ?? "");
            return (
              <button
                key={`${w.brand}-${w.model}-${w.referenceNumber}-${i}`}
                type="button"
                onClick={() => onPick(w)}
                className={`shrink-0 text-left px-3.5 py-2.5 rounded-xl border transition-colors min-w-[160px] ${
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-divider bg-white hover:border-accent/50"
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider text-muted">
                  {w.brand}
                </div>
                <div className="text-sm text-ink truncate font-medium">{w.model}</div>
                <div className="text-xs text-muted nums">
                  {w.referenceNumber || "—"}
                  {w.count > 1 ? ` · ${w.count} sold` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecentCustomers({
  customers,
  onPick,
  activeEmail,
}: {
  customers: RecentCustomer[];
  onPick: (c: RecentCustomer) => void;
  activeEmail: string;
}) {
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
        Recent customers
      </div>
      <div className="flex flex-wrap gap-1.5">
        {customers.map((c) => {
          const selected = c.email.toLowerCase() === activeEmail.toLowerCase();
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selected
                  ? "bg-accent text-white border-accent"
                  : "bg-white border-divider text-ink hover:border-accent/50"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <div>{children}</div>
    </div>
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
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      <span className="text-ink">{label}</span>
    </label>
  );
}

function TotalsSummary({
  subtotalCents,
  shippingCents,
  taxCents,
  totalCents,
}: {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}) {
  if (subtotalCents === 0 && shippingCents === 0 && taxCents === 0) return null;
  return (
    <div className="mt-4 bg-white border border-divider rounded-2xl p-5 nums">
      <SummaryRow label="Subtotal" value={formatUSD(subtotalCents)} />
      <SummaryRow label="Shipping" value={formatUSD(shippingCents)} />
      <SummaryRow label="Tax" value={formatUSD(taxCents)} />
      <div className="border-t border-divider my-3" />
      <SummaryRow
        label={<span className="text-ink uppercase tracking-wider text-xs">Total</span>}
        value={
          <span className="font-[family-name:var(--font-display)] text-2xl text-ink">
            {formatUSD(totalCents)}
          </span>
        }
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-1">
      <span className="text-muted text-sm">{label}</span>
      <span className="text-ink text-sm">{value}</span>
    </div>
  );
}
