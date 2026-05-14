"use client";

import { use, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { formatUSD } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";
import { ArrowLeft, ChevronRight, Star } from "lucide-react";

type Status =
  | "PENDING"
  | "PAID"
  | "PICKED"
  | "SHIPPED"
  | "DELIVERED"
  | "RELEASED"
  | "CANCELLED"
  | "REFUNDED";

type Event = {
  id: string;
  type: string;
  fromStatus: Status | null;
  toStatus: Status | null;
  actor: string | null;
  message: string | null;
  createdAt: string;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  externalOrderId: string | null;
  source: string;
  status: Status;
  brand: string;
  model: string;
  referenceNumber: string | null;
  year: number | null;
  condition: string;
  hasBox: boolean;
  hasPapers: boolean;
  serial: string | null;
  saleCents: number;
  shippingCents: number;
  taxCents: number;
  c24FeeCents: number;
  netToUsCents: number;
  paymentMethod: string;
  paymentConfirmedAt: string | null;
  escrowReleaseDate: string | null;
  payoutReceivedAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  pickedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  priorityFlag: boolean;
  createdAt: string;
  receiptId: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    totalOrders: number;
    totalSpentCents: number;
    vipFlag: boolean;
  };
  assignedToSeller: { id: string; name: string } | null;
  events: Event[];
};

const PROGRESS_STAGES: Status[] = ["PENDING", "PAID", "PICKED", "SHIPPED", "DELIVERED"];
const ALL_STATUSES: Status[] = [
  "PENDING",
  "PAID",
  "PICKED",
  "SHIPPED",
  "DELIVERED",
  "RELEASED",
  "CANCELLED",
  "REFUNDED",
];

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const sp = useSearchParams();
  const shipParam = sp?.get("ship");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shipFormOpen, setShipFormOpen] = useState(false);
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);

  // Tracking form state
  const [carrier, setCarrier] = useState("USPS");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Note form state
  const [note, setNote] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) {
        setLoadErr("Order not found");
        return;
      }
      const data: OrderDetail = await res.json();
      setOrder(data);
      setCarrier(data.carrier ?? "USPS");
      setTrackingNumber(data.trackingNumber ?? "");
      setTrackingUrl(data.trackingUrl ?? "");
    } catch {
      setLoadErr("Failed to load order");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-open ship form if ?ship=1
  useEffect(() => {
    if (shipParam && order?.status === "PICKED") setShipFormOpen(true);
  }, [shipParam, order?.status]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) {
    return (
      <Shell>
        <main className="max-w-2xl mx-auto px-5 pt-10 text-warn text-sm">
          {loadErr}
        </main>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <main className="max-w-2xl mx-auto px-5 pt-7 sm:pt-10">
          <div className="h-4 w-20 rounded bg-divider-soft animate-pulse" />
          <div className="mt-4 h-8 w-56 rounded bg-divider-soft animate-pulse" />
          <div className="mt-3 h-4 w-72 rounded bg-divider-soft animate-pulse" />
          <div className="mt-8 h-12 w-full rounded-full bg-divider-soft animate-pulse" />
        </main>
      </Shell>
    );
  }

  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";
  const action = primaryAction(order.status);
  const watchLine = [
    order.referenceNumber,
    order.condition,
    order.hasBox && order.hasPapers
      ? "Box & papers"
      : order.hasBox
        ? "Box"
        : order.hasPapers
          ? "Papers"
          : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const shipTo = formatShipTo(order.customer);

  function handlePrimary() {
    if (!action) return;
    if (action.kind === "CONFIRM_PAID") {
      setConfirmPaidOpen(true);
    } else if (action.kind === "PICK") {
      void patch({ status: "PICKED" });
    } else if (action.kind === "SHIP") {
      setShipFormOpen(true);
    } else if (action.kind === "DELIVER") {
      void patch({ status: "DELIVERED", deliveredAt: new Date().toISOString() });
    } else if (action.kind === "RELEASE") {
      void patch({ status: "RELEASED", payoutReceivedAt: new Date().toISOString() });
    }
  }

  async function submitTracking() {
    if (!trackingNumber.trim()) {
      alert("Tracking number is required");
      return;
    }
    await patch({
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim() || null,
      trackingUrl: trackingUrl.trim() || null,
    });
    setShipFormOpen(false);
  }

  return (
    <Shell>
      <main className="max-w-2xl mx-auto px-5 pt-5 sm:pt-8">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2.5} /> Orders
        </Link>

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-ink truncate">
              {order.customer.name}
              {order.customer.vipFlag ? (
                <span className="ml-2 align-middle text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold/15 text-gold">
                  VIP
                </span>
              ) : null}
            </h1>
            <div className="mt-1 text-sm text-ink">
              {order.brand} {order.model}
            </div>
            {watchLine ? (
              <div className="text-xs text-muted mt-0.5 nums">{watchLine}</div>
            ) : null}
          </div>
          {isCancelled ? (
            <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-[#fee2e2] text-[#991b1b]">
              {STATUS_LABEL[order.status]}
            </span>
          ) : (
            <ProgressDots status={order.status} />
          )}
        </div>

        {!isCancelled && action ? (
          <button
            type="button"
            onClick={handlePrimary}
            disabled={busy}
            className="mt-7 w-full h-12 rounded-full bg-accent hover:bg-accent-deep text-white text-base font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? "…" : action.label}
          </button>
        ) : null}

        {!action && !isCancelled ? (
          <div className="mt-7 w-full h-12 rounded-full border border-divider flex items-center justify-center text-sm text-muted">
            Completed ✓
          </div>
        ) : null}

        {shipFormOpen && order.status === "PICKED" ? (
          <div className="mt-4 card-lift p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold text-ink">Ship</div>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="bg-white border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="USPS">USPS</option>
              <option value="FedEx">FedEx</option>
              <option value="UPS">UPS</option>
              <option value="DHL">DHL</option>
              <option value="Hand-delivered">Hand-delivered</option>
              <option value="Other">Other</option>
            </select>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Tracking number"
              className="bg-white border border-divider rounded-lg px-3 py-2 text-base outline-none focus:border-accent"
            />
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="Tracking URL (optional)"
              className="bg-white border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setShipFormOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-divider text-ink text-sm hover:bg-divider-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTracking}
                disabled={busy || !trackingNumber.trim()}
                className="flex-1 py-2.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-deep disabled:opacity-50"
              >
                Save & ship
              </button>
            </div>
          </div>
        ) : null}

        {order.status === "SHIPPED" && order.trackingNumber ? (
          <div className="mt-3 text-xs text-muted nums">
            {order.carrier ? `${order.carrier} · ` : ""}
            {order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {order.trackingNumber}
              </a>
            ) : (
              order.trackingNumber
            )}
          </div>
        ) : null}

        <hr className="my-6 border-divider" />

        <section className="flex flex-col gap-1">
          <div className="flex items-baseline gap-3">
            <div className="text-xl font-semibold text-ink nums">
              {formatUSD(order.saleCents)}
            </div>
            {order.paymentConfirmedAt ? (
              <div className="text-sm text-muted">
                paid {fmtShort(order.paymentConfirmedAt)}
              </div>
            ) : (
              <div className="text-sm text-muted">payment not yet confirmed</div>
            )}
          </div>
          {order.escrowReleaseDate ? (
            <div className="text-sm text-muted">
              Escrow releases {fmtShort(order.escrowReleaseDate)}
            </div>
          ) : null}
          {shipTo ? (
            <div className="text-sm text-muted truncate">Ship to: {shipTo}</div>
          ) : null}
        </section>

        <hr className="my-6 border-divider" />

        <section>
          <h2 className="text-sm font-semibold text-muted-soft">Timeline</h2>
          <Timeline events={order.events} />
        </section>

        <hr className="my-6 border-divider" />

        <Section label={`Customer history (${order.customer.totalOrders} orders)`}>
          <CustomerHistory customerId={order.customer.id} currentOrderId={order.id} />
        </Section>

        <Section label="Full order details">
          <FullDetails order={order} />
        </Section>

        <Section label="Add note">
          <div className="flex flex-col gap-2 pt-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What happened?"
              className="w-full bg-card border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-y"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || !note.trim()}
                onClick={async () => {
                  await patch({ noteMessage: note.trim() });
                  setNote("");
                }}
                className="text-sm font-medium px-4 py-2 rounded-full bg-ink text-white disabled:opacity-50"
              >
                Save note
              </button>
            </div>
          </div>
        </Section>

        <Section label="More actions">
          <MoreActions
            order={order}
            busy={busy}
            onPatch={patch}
            onGenerateReceipt={async () => {
              setBusy(true);
              try {
                const res = await fetch(`/api/orders/${id}/receipt`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({}),
                });
                if (!res.ok) {
                  const e = await res.json().catch(() => ({}));
                  alert(e.error || "Receipt generation failed");
                  return;
                }
                const data = await res.json();
                window.location.href = data.detailUrl;
              } finally {
                setBusy(false);
              }
            }}
          />
        </Section>
      </main>

      {confirmPaidOpen ? (
        <ConfirmModal
          title="Confirm payment received?"
          confirmLabel="Yes, mark paid"
          onCancel={() => setConfirmPaidOpen(false)}
          onConfirm={async () => {
            setConfirmPaidOpen(false);
            await patch({
              status: "PAID",
              paymentConfirmedAt: new Date().toISOString(),
            });
          }}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full pb-28 sm:pb-16">
      <TopNav active="orders" />
      {children}
      <BottomNav active="orders" />
    </div>
  );
}

function ProgressDots({ status }: { status: Status }) {
  const idx = PROGRESS_STAGES.indexOf(status);
  // RELEASED counts all 5 filled
  const filled = status === "RELEASED" ? 5 : idx >= 0 ? idx + 1 : 0;
  return (
    <div className="shrink-0 flex items-center gap-1.5 pt-2" aria-label={`Status ${STATUS_LABEL[status]}`}>
      {PROGRESS_STAGES.map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < filled ? "bg-accent" : "border border-divider bg-card"
          }`}
        />
      ))}
    </div>
  );
}

function Timeline({ events }: { events: Event[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, 10);
  return (
    <ol className="mt-3 flex flex-col gap-2.5">
      {visible.map((e) => (
        <li
          key={e.id}
          className="grid grid-cols-[auto_1fr_auto] items-start gap-3 text-sm"
        >
          <div className="text-xs text-muted nums w-12 shrink-0 pt-0.5">
            {fmtShort(e.createdAt)}
          </div>
          <div className="text-ink min-w-0">
            <div>{describeEvent(e)}</div>
            {e.message ? (
              <div className="text-xs text-muted">{e.message}</div>
            ) : null}
          </div>
          <div className="text-xs text-muted-soft shrink-0">{e.actor ?? ""}</div>
        </li>
      ))}
      {events.length > 10 && !showAll ? (
        <li>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-accent hover:underline"
          >
            Show all ({events.length})
          </button>
        </li>
      ) : null}
    </ol>
  );
}

function describeEvent(e: Event): string {
  if (e.type === "STATUS_CHANGED") {
    if (e.fromStatus && e.toStatus)
      return `${STATUS_LABEL[e.fromStatus]} → ${STATUS_LABEL[e.toStatus]}`;
    if (e.toStatus) return `Marked ${STATUS_LABEL[e.toStatus].toLowerCase()}`;
  }
  if (e.type === "TRACKING_ADDED") return "Tracking added";
  if (e.type === "RECEIPT_GENERATED") return "Receipt generated";
  if (e.type === "NOTE") return "Note";
  return e.type.replace(/_/g, " ").toLowerCase();
}

function Section({ label, children }: { label: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-divider/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-3 text-left text-sm font-medium text-ink hover:text-accent transition-colors"
      >
        <ChevronRight
          size={16}
          strokeWidth={2.5}
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span>{label}</span>
      </button>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}

type MiniOrder = {
  id: string;
  orderNumber: string;
  status: Status;
  brand: string;
  model: string;
  saleCents: number;
  createdAt: string;
};

function CustomerHistory({
  customerId,
  currentOrderId,
}: {
  customerId: string;
  currentOrderId: string;
}) {
  const [data, setData] = useState<{ orders: MiniOrder[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customers/${customerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (!data) return <div className="text-sm text-muted py-2">Loading…</div>;
  const others = data.orders.filter((o) => o.id !== currentOrderId);
  if (others.length === 0)
    return <div className="text-sm text-muted py-2">No other orders.</div>;
  return (
    <ul className="flex flex-col">
      {others.map((o) => (
        <li key={o.id}>
          <Link
            href={`/orders/${o.id}`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 hover:bg-divider-soft/60 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm text-ink truncate">
                {o.brand} {o.model}
              </div>
              <div className="text-xs text-muted nums">{fmtShort(o.createdAt)}</div>
            </div>
            <span className="text-xs text-muted">{STATUS_LABEL[o.status]}</span>
            <span className="text-sm text-ink nums">{formatUSD(o.saleCents)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FullDetails({ order }: { order: OrderDetail }) {
  const rows: [string, ReactNode][] = [
    ["Order #", <span key="x" className="nums">{order.orderNumber}</span>],
    ["Source", order.source],
    ["External ID", order.externalOrderId ?? "—"],
    ["Status", STATUS_LABEL[order.status]],
    ["Sale price", formatUSD(order.saleCents)],
    ["Shipping", formatUSD(order.shippingCents)],
    ["Tax", formatUSD(order.taxCents)],
    ["C24 fee", formatUSD(order.c24FeeCents)],
    ["Net to us", formatUSD(order.netToUsCents)],
    ["Payment method", order.paymentMethod],
    [
      "Payment confirmed",
      order.paymentConfirmedAt ? fmtFull(order.paymentConfirmedAt) : "—",
    ],
    [
      "Escrow release",
      order.escrowReleaseDate ? fmtFull(order.escrowReleaseDate) : "—",
    ],
    [
      "Payout received",
      order.payoutReceivedAt ? fmtFull(order.payoutReceivedAt) : "—",
    ],
    ["Picked at", order.pickedAt ? fmtFull(order.pickedAt) : "—"],
    ["Shipped at", order.shippedAt ? fmtFull(order.shippedAt) : "—"],
    ["Delivered at", order.deliveredAt ? fmtFull(order.deliveredAt) : "—"],
    ["Carrier", order.carrier ?? "—"],
    ["Tracking", order.trackingNumber ?? "—"],
    ["Year", order.year ? String(order.year) : "—"],
    ["Condition", order.condition],
    ["Box", order.hasBox ? "Yes" : "No"],
    ["Papers", order.hasPapers ? "Yes" : "No"],
    ["Serial", order.serial ?? "—"],
    ["Assigned to", order.assignedToSeller?.name ?? "—"],
    ["Created", fmtFull(order.createdAt)],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <Detail key={k} term={k}>
          {v}
        </Detail>
      ))}
      {order.notes ? (
        <Detail term="Notes">
          <span className="whitespace-pre-line">{order.notes}</span>
        </Detail>
      ) : null}
    </dl>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="text-ink text-right">{children}</dd>
    </>
  );
}

function MoreActions({
  order,
  busy,
  onPatch,
  onGenerateReceipt,
}: {
  order: OrderDetail;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onGenerateReceipt: () => Promise<void>;
}) {
  const [showStatus, setShowStatus] = useState(false);
  const canGenReceipt =
    !order.receiptId &&
    (order.status === "SHIPPED" ||
      order.status === "DELIVERED" ||
      order.status === "RELEASED");

  return (
    <div className="flex flex-col gap-1.5 pt-2">
      <ActionLine
        onClick={() => onPatch({ priorityFlag: !order.priorityFlag })}
        disabled={busy}
        icon={
          <Star
            size={14}
            className={order.priorityFlag ? "text-gold" : "text-muted-soft"}
            fill={order.priorityFlag ? "currentColor" : "none"}
          />
        }
      >
        {order.priorityFlag ? "Unmark priority" : "Mark priority"}
      </ActionLine>

      {canGenReceipt ? (
        <ActionLine onClick={() => onGenerateReceipt()} disabled={busy}>
          Generate receipt PDF
        </ActionLine>
      ) : null}
      {order.receiptId ? (
        <Link
          href={`/history/${order.receiptId}`}
          className="px-2 py-2 rounded-md text-sm text-ink hover:bg-divider-soft/60"
        >
          View receipt
        </Link>
      ) : null}

      <ActionLine onClick={() => setShowStatus((v) => !v)}>
        Change status manually
      </ActionLine>
      {showStatus ? (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {ALL_STATUSES.filter((s) => s !== order.status).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (window.confirm(`Change status to ${STATUS_LABEL[s]}?`)) {
                  void onPatch({ status: s });
                }
              }}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded-full border border-divider hover:border-ink/40 disabled:opacity-50"
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      ) : null}

      <Link
        href={`/customers/${order.customer.id}`}
        className="px-2 py-2 rounded-md text-sm text-ink hover:bg-divider-soft/60"
      >
        Edit customer info
      </Link>
    </div>
  );
}

function ActionLine({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-2 py-2 text-left text-sm text-ink rounded-md hover:bg-divider-soft/60 disabled:opacity-50"
    >
      {icon ?? <span className="w-3.5 inline-block" />}
      <span>{children}</span>
    </button>
  );
}

function ConfirmModal({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold text-ink">{title}</div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-divider text-ink text-sm hover:bg-divider-soft transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-deep transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type ActionKind = "CONFIRM_PAID" | "PICK" | "SHIP" | "DELIVER" | "RELEASE";

function primaryAction(status: Status): { kind: ActionKind; label: string } | null {
  switch (status) {
    case "PENDING":
      return { kind: "CONFIRM_PAID", label: "Mark Paid" };
    case "PAID":
      return { kind: "PICK", label: "Mark Picked" };
    case "PICKED":
      return { kind: "SHIP", label: "Add Tracking & Ship" };
    case "SHIPPED":
      return { kind: "DELIVER", label: "Confirm Delivered" };
    case "DELIVERED":
      return { kind: "RELEASE", label: "Mark Released" };
    default:
      return null;
  }
}

function fmtShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}
function fmtFull(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatShipTo(c: OrderDetail["customer"]): string {
  const parts: string[] = [];
  if (c.city && c.state) parts.push(`${c.city}, ${c.state}`);
  else if (c.city) parts.push(c.city);
  else if (c.state) parts.push(c.state);
  if (c.zip) parts.push(c.zip);
  return parts.join(" ");
}

void Star;
