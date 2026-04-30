"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Field, Textarea, LineInput } from "@/components/Field";
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
  const [showAddress, setShowAddress] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const saved = loadForm();
    if (saved) {
      setForm(saved);
      if (saved.customer.addressLines || saved.customer.street) setShowAddress(true);
    }
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
      setForm((f) =>
        !f.payment.bankAccountId && b.length
          ? { ...f, payment: { ...f.payment, bankAccountId: b[0].id } }
          : f,
      );
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

  const step1Done =
    form.customer.email.trim().length > 3 && form.customer.name.trim().length > 0;
  const step2Done =
    form.watch.brand.trim().length > 0 && form.watch.model.trim().length > 0;
  const step3Done = subtotalCents > 0;
  const step4Done = !!form.payment.method;
  const step5Done = true;
  const allDone = step1Done && step2Done && step3Done && step4Done && step5Done;

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
    if (addr) setShowAddress(true);
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
        body: JSON.stringify({ form: collapseAddress(form) }),
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
    <div className="min-h-full pb-32">
      <TopNav active="new" />
      <main className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          What did you sell?
        </h1>
        <p className="text-base text-muted mt-1.5">
          Fill in five things. Voice support coming next.
        </p>

        <div className="mt-7 bg-white border border-divider rounded-2xl divide-y divide-divider">
          <Step n={1} title="Customer" done={step1Done}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <LineInput
                placeholder="Name"
                value={form.customer.name}
                onChange={(e) => patch("customer", { name: e.target.value })}
              />
              <LineInput
                type="email"
                inputMode="email"
                placeholder="Email"
                value={form.customer.email}
                onChange={(e) => patch("customer", { email: e.target.value })}
              />
            </div>
            {recentCustomers.length > 0 && !step1Done ? (
              <ChipRow>
                {recentCustomers.map((c) => (
                  <Chip
                    key={c.id}
                    onClick={() => applyCustomerChip(c)}
                    selected={c.email.toLowerCase() === form.customer.email.toLowerCase()}
                  >
                    {c.name}
                  </Chip>
                ))}
              </ChipRow>
            ) : null}
            {showAddress ? (
              <Textarea
                rows={3}
                placeholder={"123 Main St\nBrooklyn, NY 11201"}
                value={form.customer.addressLines}
                onChange={(e) => patch("customer", { addressLines: e.target.value })}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddress(true)}
                className="self-start text-sm text-accent hover:text-accent-deep"
              >
                + Add shipping address
              </button>
            )}
          </Step>

          <Step n={2} title="Watch" done={step2Done}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <LineInput
                placeholder="Brand"
                list="brand-suggestions"
                value={form.watch.brand}
                onChange={(e) => patch("watch", { brand: e.target.value })}
              />
              <LineInput
                placeholder="Model + ref. #"
                value={form.watch.model}
                onChange={(e) => patch("watch", { model: e.target.value })}
              />
            </div>
            <datalist id="brand-suggestions">
              {brands.map((b) => (
                <option key={b.name} value={b.name} />
              ))}
            </datalist>
            {recentWatches.length > 0 && !step2Done ? (
              <ChipRow>
                {recentWatches.map((w, i) => {
                  const selected =
                    form.watch.brand === w.brand && form.watch.model === w.model;
                  return (
                    <Chip
                      key={`${w.brand}-${w.model}-${i}`}
                      onClick={() => applyWatchCard(w)}
                      selected={selected}
                    >
                      {w.brand} {w.model}
                    </Chip>
                  );
                })}
              </ChipRow>
            ) : null}
          </Step>

          <Step n={3} title="Amount paid" done={step3Done}>
            <LineInput
              prefix="$"
              inputMode="decimal"
              placeholder="0.00"
              value={form.payment.amountUsd}
              onChange={(e) => patch("payment", { amountUsd: e.target.value })}
              className="text-xl"
            />
          </Step>

          <Step n={4} title="How they paid" done={step4Done}>
            <PillToggle
              value={form.payment.method}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
              onChange={(m) => patch("payment", { method: m })}
              size="sm"
              ariaLabel="Payment method"
            />
          </Step>

          <Step n={5} title="Box and papers" done={step5Done}>
            <div className="flex gap-5">
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
          </Step>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          {sellers.length > 0 ? (
            <PillToggle
              value={form.seller.soldBy}
              options={sellers.map((s) => ({ value: s.name, label: s.name }))}
              onChange={selectSeller}
              size="sm"
              ariaLabel="Sold by"
            />
          ) : null}
          {banks.length > 0 ? (
            <PillToggle
              value={form.payment.bankAccountId}
              options={banks.map((b) => ({ value: b.id, label: b.label }))}
              onChange={(id) => patch("payment", { bankAccountId: id })}
              size="sm"
              ariaLabel="Bank account"
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="mt-5 text-sm text-accent hover:text-accent-deep"
        >
          {showMore ? "− Hide options" : "+ More options"}
        </button>

        {showMore ? (
          <div className="mt-4 bg-white border border-divider rounded-2xl p-5 flex flex-col gap-5">
            <FieldGroup title="Payment details">
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
            </FieldGroup>

            <FieldGroup title="Watch details">
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
                <span className="text-sm text-muted">Condition</span>
                <PillToggle
                  value={form.watch.condition}
                  options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                  onChange={(v) => patch("watch", { condition: v })}
                  size="sm"
                  ariaLabel="Condition"
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Totals">
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
            </FieldGroup>

            <FieldGroup title="Commission">
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
            </FieldGroup>

            <FieldGroup title="Notes">
              <Textarea
                rows={2}
                placeholder="Internal notes (not on the receipt)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </FieldGroup>
          </div>
        ) : null}

        <MicPlaceholder />

        {error ? (
          <div className="mt-5 p-4 rounded-lg bg-white border border-warn/40 text-warn text-sm">
            {error}
          </div>
        ) : null}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-divider">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
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
            className="bg-accent hover:bg-accent-deep text-white font-medium text-base py-3 px-6 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save receipt →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3.5 px-5 py-5">
      <div className="shrink-0 pt-0.5">
        {done ? (
          <div className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center text-sm">
            ✓
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border border-divider text-muted flex items-center justify-center text-sm font-medium">
            {n}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="text-base text-ink font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
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

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-muted font-medium">{title}</div>
      {children}
    </div>
  );
}

function MicPlaceholder() {
  return (
    <div className="mt-6 bg-white border border-dashed border-divider rounded-2xl px-5 py-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-divider-soft flex items-center justify-center text-2xl">
        🎤
      </div>
      <div className="flex-1">
        <div className="text-base text-ink font-medium">Hold to speak</div>
        <div className="text-sm text-muted">
          Say one sentence and the form fills itself. Wires up next.
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
