"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { dollarsToCents, formatUSD } from "@/lib/money";

type SourceStr = "CHRONO24" | "PRIVATE" | "STUDIO_CHRONO_SITE" | "REFERRAL" | "OTHER";

const SOURCES: { value: SourceStr; label: string }[] = [
  { value: "CHRONO24", label: "Chrono24" },
  { value: "PRIVATE", label: "Private / wire" },
  { value: "STUDIO_CHRONO_SITE", label: "SC site" },
  { value: "REFERRAL", label: "Referral" },
  { value: "OTHER", label: "Other" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [source, setSource] = useState<SourceStr>("CHRONO24");
  const [externalId, setExternalId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateF, setStateF] = useState("");
  const [zip, setZip] = useState("");
  const [brand, setBrand] = useState("Rolex");
  const [model, setModel] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [year, setYear] = useState("");
  const [hasBox, setHasBox] = useState(true);
  const [hasPapers, setHasPapers] = useState(true);
  const [salePrice, setSalePrice] = useState("");
  const [shipping, setShipping] = useState("");
  const [c24Fee, setC24Fee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Chrono24Escrow");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [escrowDate, setEscrowDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saleCents = dollarsToCents(salePrice);
  const shippingCents = dollarsToCents(shipping);
  const c24FeeCents = dollarsToCents(c24Fee);
  const netToUsCents = saleCents - c24FeeCents;

  const ready = name.trim() && email.trim() && brand.trim() && model.trim() && saleCents > 0;

  async function submit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        externalOrderId: externalId.trim() || null,
        source,
        customer: {
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim() || null,
          street: street.trim() || null,
          city: city.trim() || null,
          state: stateF.trim() || null,
          zip: zip.trim() || null,
        },
        watch: {
          brand: brand.trim(),
          model: model.trim(),
          referenceNumber: referenceNumber.trim() || null,
          year: year ? Number(year) : null,
          condition: "New",
          hasBox,
          hasPapers,
        },
        money: {
          saleCents,
          shippingCents,
          c24FeeCents,
          netToUsCents,
        },
        paymentMethod,
        paymentConfirmedAt: paymentConfirmed ? new Date().toISOString() : null,
        escrowReleaseDate: escrowDate || null,
        notes: notes.trim() || null,
      };
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to create order");
      }
      const created = await res.json();
      router.push(`/orders/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full pb-32 sm:pb-16">
      <TopNav active="orders" />
      <main className="max-w-2xl mx-auto px-4 pt-6">
        <Link href="/orders" className="text-xs text-muted hover:text-ink">
          ← Orders
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-1">New order</h1>

        <div className="mt-5 card-lift p-5 flex flex-col gap-4">
          <div>
            <Label>Source</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    source === s.value
                      ? "bg-accent text-white border-accent"
                      : "bg-white border-divider text-muted hover:border-accent/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {source === "CHRONO24" ? (
            <Field label="C24 ticket #">
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="TC-12781928"
                className={inputCls}
              />
            </Field>
          ) : null}
        </div>

        <div className="mt-4 card-lift p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink">Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Street">
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="City">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <input
                  value={stateF}
                  onChange={(e) => setStateF(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="ZIP">
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-4 card-lift p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink">Watch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Brand">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Model">
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Reference #">
              <input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Year">
              <input
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={hasBox}
                onChange={(e) => setHasBox(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Box
            </label>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={hasPapers}
                onChange={(e) => setHasPapers(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Papers
            </label>
          </div>
        </div>

        <div className="mt-4 card-lift p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink">Money</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Sale price (USD)">
              <input
                inputMode="decimal"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="18500"
                className={inputCls}
              />
            </Field>
            <Field label="Shipping">
              <input
                inputMode="decimal"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="C24 fee">
              <input
                inputMode="decimal"
                value={c24Fee}
                onChange={(e) => setC24Fee(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="text-sm nums text-muted">
            Net to us:{" "}
            <span className="text-ink font-semibold">{formatUSD(netToUsCents)}</span>
          </div>
        </div>

        <div className="mt-4 card-lift p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink">Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Method">
              <input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Escrow release date">
              <input
                type="date"
                value={escrowDate}
                onChange={(e) => setEscrowDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={paymentConfirmed}
              onChange={(e) => setPaymentConfirmed(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Payment confirmed (start at PAID instead of PENDING)
          </label>
        </div>

        <div className="mt-4 card-lift p-5">
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-white border border-divider rounded-md px-3 py-2 text-sm outline-none focus:border-accent resize-y"
            />
          </Field>
        </div>

        {error ? (
          <div className="mt-4 p-3 rounded-lg bg-white border border-warn/40 text-warn text-sm">
            {error}
          </div>
        ) : null}
      </main>

      <div className="fixed bottom-[64px] sm:bottom-0 inset-x-0 z-30 bg-bg/95 backdrop-blur-md border-t border-divider">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 nums">
            <div className="text-xs text-muted">Sale</div>
            <div className="text-xl font-semibold text-ink leading-tight">
              {formatUSD(saleCents)}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || submitting}
            className="bg-accent hover:bg-accent-deep text-white font-semibold text-base py-3 px-6 rounded-full disabled:opacity-40 transition-colors shadow-sm"
          >
            {submitting ? "Saving…" : "Create order →"}
          </button>
        </div>
      </div>
      <BottomNav active="orders" />
    </div>
  );
}

const inputCls =
  "w-full bg-white border border-divider rounded-md px-3 py-2 text-sm text-ink outline-none focus:border-accent";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
