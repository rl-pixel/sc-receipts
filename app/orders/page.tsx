"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { formatUSD } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";
import { Star, Plus, ChevronRight } from "lucide-react";

type Status =
  | "PENDING"
  | "PAID"
  | "PICKED"
  | "SHIPPED"
  | "DELIVERED"
  | "RELEASED"
  | "CANCELLED"
  | "REFUNDED";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: Status;
  brand: string;
  model: string;
  referenceNumber: string | null;
  saleCents: number;
  priorityFlag: boolean;
  paymentConfirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  payoutReceivedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string };
};

type ListResponse = {
  orders: OrderRow[];
  totalCents: number;
  count: number;
  byStatus: Record<string, number>;
};

const QUEUE_FILTERS: Status[] = ["PAID", "PICKED", "SHIPPED"];
const RECENT_FILTERS: Status[] = ["DELIVERED", "RELEASED"];
const ALL_FILTERS: Status[] = [
  "PENDING",
  "PAID",
  "PICKED",
  "SHIPPED",
  "DELIVERED",
  "RELEASED",
  "CANCELLED",
  "REFUNDED",
];

export default function OrdersPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<OrderRow[] | null>(null);
  const [pending, setPending] = useState<OrderRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [recently, setRecently] = useState<OrderRow[] | null>(null);
  const [recentlyOpen, setRecentlyOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [confirmPaidId, setConfirmPaidId] = useState<string | null>(null);

  async function loadQueue() {
    const res = await fetch(`/api/orders?status=${QUEUE_FILTERS.join(",")}`);
    if (!res.ok) return;
    const data: ListResponse = await res.json();
    setQueue(data.orders);
    setByStatus(data.byStatus);
  }

  async function loadPending() {
    const res = await fetch(`/api/orders?status=PENDING`);
    if (!res.ok) return;
    const data: ListResponse = await res.json();
    setPending(data.orders);
  }

  async function loadRecently() {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const res = await fetch(
      `/api/orders?status=${RECENT_FILTERS.join(",")}&from=${since.toISOString()}`,
    );
    if (!res.ok) return;
    const data: ListResponse = await res.json();
    setRecently(data.orders);
  }

  async function reloadAll() {
    await Promise.all([loadQueue(), loadPending()]);
    if (recentlyOpen) await loadRecently();
  }

  useEffect(() => {
    void reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recentlyOpen && !recently) void loadRecently();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentlyOpen]);

  // Sort: priority desc → paymentConfirmedAt asc → createdAt asc
  const sortedQueue = useMemo(() => {
    if (!queue) return [];
    return [...queue].sort((a, b) => {
      if (a.priorityFlag !== b.priorityFlag) return a.priorityFlag ? -1 : 1;
      const aP = a.paymentConfirmedAt ? new Date(a.paymentConfirmedAt).getTime() : Infinity;
      const bP = b.paymentConfirmedAt ? new Date(b.paymentConfirmedAt).getTime() : Infinity;
      if (aP !== bP) return aP - bP;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [queue]);

  const sortedPending = useMemo(() => {
    return [...pending].sort((a, b) => {
      if (a.priorityFlag !== b.priorityFlag) return a.priorityFlag ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [pending]);

  const heroCount =
    (byStatus.PAID ?? 0) + (byStatus.PICKED ?? 0) + (byStatus.SHIPPED ?? 0);

  const breakdownParts: string[] = [];
  if (byStatus.PAID) breakdownParts.push(`${byStatus.PAID} paid`);
  if (byStatus.PICKED) breakdownParts.push(`${byStatus.PICKED} picked`);
  if (byStatus.SHIPPED) breakdownParts.push(`${byStatus.SHIPPED} shipped`);

  async function patchOrder(id: string, body: Record<string, unknown>) {
    setBusyRow(id);
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
      await reloadAll();
    } finally {
      setBusyRow(null);
    }
  }

  function handleAction(o: OrderRow) {
    if (o.status === "PENDING") {
      setConfirmPaidId(o.id);
      return;
    }
    if (o.status === "PAID") {
      void patchOrder(o.id, { status: "PICKED" });
      return;
    }
    if (o.status === "PICKED") {
      router.push(`/orders/${o.id}?ship=1`);
      return;
    }
    if (o.status === "SHIPPED") {
      void patchOrder(o.id, {
        status: "DELIVERED",
        deliveredAt: new Date().toISOString(),
      });
      return;
    }
  }

  const loading = queue === null;
  const isEmpty = !loading && sortedQueue.length === 0 && sortedPending.length === 0;

  return (
    <div className="min-h-full pb-28 sm:pb-16">
      <TopNav active="orders" />
      <main className="max-w-2xl mx-auto px-5 pt-7 sm:pt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Orders</h1>
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} /> New
          </Link>
        </div>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <section className="mt-7">
              {loading ? (
                <>
                  <div className="h-10 w-44 rounded bg-divider-soft animate-pulse" />
                  <div className="mt-2 h-4 w-32 rounded bg-divider-soft animate-pulse" />
                </>
              ) : (
                <>
                  <div className="text-4xl font-semibold text-ink leading-none nums">
                    {heroCount} ready to ship
                  </div>
                  {breakdownParts.length > 0 ? (
                    <div className="mt-2 text-sm text-muted nums">
                      {breakdownParts.join(" · ")}
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <hr className="my-6 border-divider" />

            <ul className="flex flex-col">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : (
                sortedQueue.map((o) => (
                  <Row
                    key={o.id}
                    order={o}
                    busy={busyRow === o.id}
                    onAction={() => handleAction(o)}
                    onTogglePriority={() =>
                      patchOrder(o.id, { priorityFlag: !o.priorityFlag })
                    }
                  />
                ))
              )}
            </ul>

            {sortedPending.length > 0 ? (
              <section className="mt-8">
                <h2 className="text-xs uppercase tracking-wide text-muted-soft px-1">
                  Awaiting payment
                </h2>
                <ul className="mt-1 flex flex-col">
                  {sortedPending.map((o) => (
                    <Row
                      key={o.id}
                      order={o}
                      busy={busyRow === o.id}
                      onAction={() => handleAction(o)}
                      onTogglePriority={() =>
                        patchOrder(o.id, { priorityFlag: !o.priorityFlag })
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}

        <hr className="my-7 border-divider" />

        <Collapsible
          open={recentlyOpen}
          onToggle={() => setRecentlyOpen((v) => !v)}
          label={
            <>
              Recently shipped{" "}
              <span className="text-muted-soft">
                ({(byStatus.DELIVERED ?? 0) + (byStatus.RELEASED ?? 0)})
              </span>
            </>
          }
        >
          {recently === null ? (
            <div className="py-3 text-sm text-muted">Loading…</div>
          ) : recently.length === 0 ? (
            <div className="py-3 text-sm text-muted">Nothing in the last 14 days.</div>
          ) : (
            <ul className="flex flex-col">
              {recently.map((o) => (
                <Row
                  key={o.id}
                  order={o}
                  busy={false}
                  onAction={() => {}}
                  onTogglePriority={() =>
                    patchOrder(o.id, { priorityFlag: !o.priorityFlag })
                  }
                  hideAction
                />
              ))}
            </ul>
          )}
        </Collapsible>

        <Collapsible
          open={otherOpen}
          onToggle={() => setOtherOpen((v) => !v)}
          label="Other"
        >
          <OtherPanel onChange={() => void reloadAll()} />
        </Collapsible>
      </main>

      {confirmPaidId ? (
        <ConfirmModal
          title="Confirm payment received?"
          confirmLabel="Yes, mark paid"
          onCancel={() => setConfirmPaidId(null)}
          onConfirm={async () => {
            const id = confirmPaidId;
            setConfirmPaidId(null);
            await patchOrder(id, {
              status: "PAID",
              paymentConfirmedAt: new Date().toISOString(),
            });
          }}
        />
      ) : null}

      <BottomNav active="orders" />
    </div>
  );
}

function Row({
  order,
  busy,
  onAction,
  onTogglePriority,
  hideAction = false,
}: {
  order: OrderRow;
  busy: boolean;
  onAction: () => void;
  onTogglePriority: () => void;
  hideAction?: boolean;
}) {
  const meta = formatStatusMeta(order);
  const overdue = isOverdue(order);
  const action = primaryActionLabel(order.status);

  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        className="group grid grid-cols-[1fr_auto_auto] items-center gap-3 px-1 py-4 border-b border-divider/60 hover:bg-divider-soft/50 transition-colors"
      >
        <div className="min-w-0">
          <div className="text-base font-semibold text-ink truncate">
            {order.customer.name}
          </div>
          <div className="text-sm text-muted-soft truncate">
            {order.brand} {order.model}
            {order.referenceNumber ? ` ${order.referenceNumber}` : ""}
          </div>
          <div className="text-xs text-muted">{meta}</div>
        </div>

        {action && !hideAction ? (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAction();
            }}
            className={`shrink-0 text-sm font-medium px-3.5 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
              overdue
                ? "bg-accent text-white border-accent hover:bg-accent-deep"
                : "bg-card text-ink border-divider hover:border-ink/40"
            }`}
          >
            {busy ? "…" : action}
          </button>
        ) : (
          <span className="shrink-0 w-px" />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePriority();
          }}
          aria-label={order.priorityFlag ? "Unmark priority" : "Mark priority"}
          className="shrink-0 -mr-1 p-1"
        >
          <Star
            size={16}
            strokeWidth={2}
            className={
              order.priorityFlag
                ? "text-gold"
                : "text-muted-soft/40 group-hover:text-muted-soft"
            }
            fill={order.priorityFlag ? "currentColor" : "none"}
          />
        </button>
      </Link>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 px-1 py-4 border-b border-divider/60">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-divider-soft animate-pulse" />
        <div className="h-3 w-56 rounded bg-divider-soft animate-pulse" />
        <div className="h-3 w-24 rounded bg-divider-soft animate-pulse" />
      </div>
      <div className="h-7 w-16 rounded-full bg-divider-soft animate-pulse" />
    </li>
  );
}

function EmptyState() {
  return (
    <section className="mt-12 text-center">
      <div className="text-3xl font-semibold text-ink">All caught up</div>
      <div className="mt-2 text-sm text-muted">
        No orders need shipping right now.
      </div>
      <Link
        href="/orders/new"
        className="mt-7 inline-flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-accent-deep transition-colors"
      >
        <Plus size={16} strokeWidth={2.5} /> New Order
      </Link>
    </section>
  );
}

function Collapsible({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left text-sm font-medium text-ink py-2 hover:text-accent transition-colors"
      >
        <ChevronRight
          size={16}
          strokeWidth={2.5}
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span>{label}</span>
      </button>
      {open ? <div className="pb-2">{children}</div> : null}
    </div>
  );
}

function OtherPanel({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<Status>>(new Set());
  const [priority, setPriority] = useState(false);
  const [sort, setSort] = useState("priority");
  const [results, setResults] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (picked.size > 0) params.set("status", Array.from(picked).join(","));
      else params.set("status", ALL_FILTERS.join(","));
      if (q.trim()) params.set("q", q.trim());
      if (priority) params.set("priority", "true");
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/orders?${params}`);
      if (!res.ok) return;
      const data: ListResponse = await res.json();
      setResults(data.orders);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void search(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, picked, priority, sort]);

  function togglePick(s: Status) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search customer, watch, ref, order #"
        className="w-full bg-card border border-divider rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5">
        {ALL_FILTERS.map((s) => {
          const on = picked.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => togglePick(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                on
                  ? "bg-ink text-white border-ink"
                  : "bg-card border-divider text-muted hover:border-ink/40"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={priority}
            onChange={(e) => setPriority(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          Priority only
        </label>
        <label className="inline-flex items-center gap-1.5">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-card border border-divider rounded-md px-2 py-1 text-xs outline-none focus:border-accent"
          >
            <option value="priority">Priority + recent</option>
            <option value="created">Most recent</option>
            <option value="value">Value (high → low)</option>
            <option value="escrowDate">Escrow date</option>
          </select>
        </label>
      </div>
      <ul className="flex flex-col">
        {loading && !results ? (
          <li className="py-3 text-sm text-muted">Searching…</li>
        ) : !results || results.length === 0 ? (
          <li className="py-3 text-sm text-muted">No matches.</li>
        ) : (
          results.map((o) => (
            <Row
              key={o.id}
              order={o}
              busy={false}
              onAction={() => onChange()}
              onTogglePriority={async () => {
                await fetch(`/api/orders/${o.id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ priorityFlag: !o.priorityFlag }),
                });
                await search();
                onChange();
              }}
              hideAction
            />
          ))
        )}
      </ul>
    </div>
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

// — formatting helpers —

function primaryActionLabel(status: Status): string | null {
  switch (status) {
    case "PENDING":
      return "Confirm Paid";
    case "PAID":
      return "Pick";
    case "PICKED":
      return "Ship";
    case "SHIPPED":
      return "Confirm";
    default:
      return null;
  }
}

function formatStatusMeta(o: OrderRow): string {
  const ago = (iso: string | null) => (iso ? relativeDays(iso) : "");
  switch (o.status) {
    case "PENDING":
      return `Created ${ago(o.createdAt)}`;
    case "PAID":
      return `Paid ${ago(o.paymentConfirmedAt)}`;
    case "PICKED":
      return `Picked ${ago(o.paymentConfirmedAt)}`;
    case "SHIPPED":
      return `Shipped ${ago(o.shippedAt)}`;
    case "DELIVERED":
      return `Delivered ${ago(o.deliveredAt)}`;
    case "RELEASED":
      return `Released ${ago(o.payoutReceivedAt ?? o.deliveredAt)}`;
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
  }
}

function relativeDays(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );
}

function isOverdue(o: OrderRow): boolean {
  if (o.status !== "PAID" && o.status !== "PICKED") return false;
  if (!o.paymentConfirmedAt) return false;
  const days = (Date.now() - new Date(o.paymentConfirmedAt).getTime()) / 86400000;
  return days > 3;
}

// suppress lint warning for unused formatUSD if not referenced
void formatUSD;
