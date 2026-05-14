"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { formatUSD } from "@/lib/money";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/order-status";

type Status =
  | "PENDING"
  | "PAID"
  | "PICKED"
  | "SHIPPED"
  | "DELIVERED"
  | "RELEASED"
  | "CANCELLED"
  | "REFUNDED";

type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  source: string | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  totalOrders: number;
  totalSpentCents: number;
  vipFlag: boolean;
  createdAt: string;
  orders: {
    id: string;
    orderNumber: string;
    status: Status;
    brand: string;
    model: string;
    referenceNumber: string | null;
    saleCents: number;
    createdAt: string;
  }[];
  receipts: { id: string; receiptNumber: string; totalCents: number; createdAt: string }[];
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/customers/${id}`);
    if (r.ok) setC(await r.json());
    setLoading(false);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleVip() {
    if (!c) return;
    setBusy(true);
    await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vipFlag: !c.vipFlag }),
    });
    setBusy(false);
    await load();
  }

  if (loading && !c) {
    return (
      <div className="min-h-full">
        <TopNav />
        <main className="max-w-3xl mx-auto px-4 pt-10 text-muted text-sm">Loading…</main>
        <BottomNav />
      </div>
    );
  }
  if (!c) {
    return (
      <div className="min-h-full">
        <TopNav />
        <main className="max-w-3xl mx-auto px-4 pt-10 text-warn text-sm">
          Customer not found.
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 sm:pb-16">
      <TopNav />
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <Link href="/orders" className="text-xs text-muted hover:text-ink">
          ← Orders
        </Link>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              {c.name}
              {c.vipFlag ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gold-soft text-warn">
                  VIP
                </span>
              ) : null}
            </h1>
            <div className="text-sm text-muted mt-0.5">{c.email}</div>
            {c.phone ? <div className="text-sm text-muted">{c.phone}</div> : null}
            {c.street ? (
              <div className="text-xs text-muted mt-2 whitespace-pre-line">
                {[c.street, [c.city, c.state].filter(Boolean).join(", "), c.zip, c.country]
                  .filter(Boolean)
                  .join("\n")}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggleVip}
            disabled={busy}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              c.vipFlag
                ? "bg-gold-soft border-gold text-warn"
                : "bg-card border-divider text-muted hover:border-gold"
            }`}
          >
            {c.vipFlag ? "VIP ★" : "Mark VIP"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm nums">
          <Stat label="Orders" value={String(c.totalOrders)} />
          <Stat label="Lifetime spend" value={formatUSD(c.totalSpentCents)} />
          <Stat label="First order" value={c.firstOrderAt ? fmtDate(c.firstOrderAt) : "—"} />
          <Stat label="Last order" value={c.lastOrderAt ? fmtDate(c.lastOrderAt) : "—"} />
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-ink">Orders</h2>
          <ul className="mt-2 divide-y divide-divider border border-divider rounded-xl overflow-hidden bg-card">
            {c.orders.length === 0 ? (
              <li className="p-6 text-center text-muted text-sm">No orders yet.</li>
            ) : (
              c.orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 hover:bg-divider-soft transition-colors"
                  >
                    <div className="text-xs text-muted nums w-20 shrink-0">
                      {fmtDate(o.createdAt)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-ink truncate">
                        {o.brand} {o.model}
                      </div>
                      <div className="text-xs text-muted truncate nums">
                        {o.orderNumber}
                        {o.referenceNumber ? ` · ${o.referenceNumber}` : ""}
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </div>
                    <div className="text-ink nums">{formatUSD(o.saleCents)}</div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>

        {c.receipts.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-ink">Receipts</h2>
            <ul className="mt-2 divide-y divide-divider border border-divider rounded-xl overflow-hidden bg-card">
              {c.receipts.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/history/${r.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-divider-soft transition-colors"
                  >
                    <div>
                      <div className="text-ink nums">{r.receiptNumber}</div>
                      <div className="text-xs text-muted">{fmtDate(r.createdAt)}</div>
                    </div>
                    <div className="text-ink nums">{formatUSD(r.totalCents)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-divider rounded-lg px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-ink text-base">{value}</div>
    </div>
  );
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}
