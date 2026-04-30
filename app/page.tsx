"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Section } from "@/components/Section";
import { Field } from "@/components/Field";
import { PillToggle } from "@/components/PillToggle";
import {
  emptyForm,
  loadForm,
  saveForm,
  clearForm,
} from "@/lib/form-state";
import { CONDITIONS, PAYMENT_METHODS, type FormState } from "@/lib/types";
import { dollarsToCents, formatUSD } from "@/lib/money";
import { resolveCommissionCents } from "@/lib/commission";

type Bank = { id: string; label: string; acceptsZelle: boolean; acceptsWire: boolean };
type Seller = { id: string; name: string; defaultCommissionType: string | null; defaultCommissionValue: number | null };
type Brand = { name: string; useCount: number };

export default function NewReceiptPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    ]).then(([b, s, br]) => {
      setBanks(b);
      setSellers(s);
      setBrands(br);
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

  function selectSeller(name: string) {
    const s = sellers.find((x) => x.name === name);
    setForm((f) => {
      const next: FormState = { ...f, seller: { ...f.seller, soldBy: name } };
      const blankCommission = !f.seller.commissionType && !f.seller.commissionValue;
      if (s && blankCommission) {
        next.seller.commissionType = (s.defaultCommissionType as "percent" | "flat" | null) ?? null;
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
        body: JSON.stringify({ form }),
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
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          New receipt.
        </h1>
        <p className="font-[family-name:var(--font-display)] italic text-muted text-sm mt-1">
          Send in seconds.
        </p>

        <div className="mt-8 flex flex-col gap-10">
          <Section title="Payment">
            <Field
              label="Sender"
              placeholder="Brian Hodge"
              value={form.payment.sender}
              onChange={(e) => patch("payment", { sender: e.target.value })}
            />
            <Field
              label="Amount"
              prefix="$"
              inputMode="decimal"
              placeholder="0.00"
              value={form.payment.amountUsd}
              onChange={(e) => patch("payment", { amountUsd: e.target.value })}
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
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-muted">Method</span>
              <div className="flex flex-wrap gap-1.5">
                <PillToggle
                  value={form.payment.method}
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                  onChange={(m) => patch("payment", { method: m })}
                  size="sm"
                  ariaLabel="Payment method"
                />
              </div>
            </div>
          </Section>

          <Section title="Bank — deposited to">
            {banks.length === 0 ? (
              <p className="text-sm text-muted">
                No bank accounts yet. Add one in{" "}
                <a className="text-ink underline" href="/settings">
                  Settings
                </a>
                .
              </p>
            ) : (
              <PillToggle
                value={form.payment.bankAccountId}
                options={banks.map((b) => ({ value: b.id, label: b.label }))}
                onChange={(id) => patch("payment", { bankAccountId: id })}
                size="sm"
                ariaLabel="Bank account"
              />
            )}
          </Section>

          <Section title="Sold by">
            {sellers.length > 0 ? (
              <PillToggle
                value={form.seller.soldBy}
                options={sellers.map((s) => ({ value: s.name, label: s.name }))}
                onChange={selectSeller}
                ariaLabel="Sold by"
              />
            ) : null}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wider text-muted">Commission</span>
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
              </div>
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
                {form.seller.soldBy}'s commission: <span className="text-success">{formatUSD(commissionAmountCents)}</span>
              </p>
            ) : null}
          </Section>

          <Section title="Customer">
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
            <Field
              label="Phone"
              type="tel"
              inputMode="tel"
              placeholder="Optional"
              value={form.customer.phone}
              onChange={(e) => patch("customer", { phone: e.target.value })}
            />
            <Field
              label="Street"
              placeholder="123 Main St"
              value={form.customer.street}
              onChange={(e) => patch("customer", { street: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="City"
                placeholder="Brooklyn"
                value={form.customer.city}
                onChange={(e) => patch("customer", { city: e.target.value })}
              />
              <Field
                label="State"
                placeholder="NY"
                value={form.customer.state}
                onChange={(e) => patch("customer", { state: e.target.value })}
              />
            </div>
            <Field
              label="ZIP"
              inputMode="numeric"
              placeholder="11201"
              value={form.customer.zip}
              onChange={(e) => patch("customer", { zip: e.target.value })}
            />
          </Section>

          <Section title="Watch">
            <Field
              label="Brand"
              placeholder="Rolex"
              list="brand-suggestions"
              value={form.watch.brand}
              onChange={(e) => patch("watch", { brand: e.target.value })}
            />
            <datalist id="brand-suggestions">
              {brands.map((b) => (
                <option key={b.name} value={b.name} />
              ))}
            </datalist>
            <Field
              label="Model"
              placeholder="Submariner Date"
              value={form.watch.model}
              onChange={(e) => patch("watch", { model: e.target.value })}
            />
            <Field
              label="Reference #"
              placeholder="126610LN"
              value={form.watch.referenceNumber}
              onChange={(e) => patch("watch", { referenceNumber: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
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
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-muted">Condition</span>
              <PillToggle
                value={form.watch.condition}
                options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                onChange={(v) => patch("watch", { condition: v })}
                size="sm"
                ariaLabel="Condition"
              />
            </div>
            <div className="flex gap-6 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch.hasBox}
                  onChange={(e) => patch("watch", { hasBox: e.target.checked })}
                  className="h-4 w-4 accent-ink"
                />
                <span>Box</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch.hasPapers}
                  onChange={(e) => patch("watch", { hasPapers: e.target.checked })}
                  className="h-4 w-4 accent-ink"
                />
                <span>Papers</span>
              </label>
            </div>
          </Section>

          <Section title="Totals">
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

            <div className="bg-card border border-divider rounded-xl p-4 mt-2 nums">
              <Row label="Subtotal" value={formatUSD(subtotalCents)} muted />
              <Row label="Shipping" value={formatUSD(shippingCents)} muted />
              <Row label="Tax" value={formatUSD(taxCents)} muted />
              <div className="border-t border-divider my-2" />
              <Row
                label={<span className="text-ink uppercase tracking-wider text-xs">Total paid</span>}
                value={
                  <span className="font-[family-name:var(--font-display)] text-2xl text-ink">
                    {formatUSD(totalCents)}
                  </span>
                }
              />
            </div>
          </Section>
        </div>

        {error ? (
          <div className="mt-6 p-4 rounded-lg bg-card border border-warn/30 text-warn text-sm">
            {error}
          </div>
        ) : null}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-divider">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="w-full bg-ink text-bg font-medium uppercase tracking-wider text-sm py-4 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {submitting ? "Creating receipt…" : "Preview & Save Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-1">
      <span className={muted ? "text-muted text-sm" : ""}>{label}</span>
      <span className={muted ? "text-muted text-sm" : ""}>{value}</span>
    </div>
  );
}
