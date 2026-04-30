import Link from "next/link";
import { db } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { formatUSD } from "@/lib/money";

type SP = {
  q?: string;
  range?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const range = sp.range ?? "all";

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { customer: { name: { contains: q } } },
      { customer: { email: { contains: q } } },
      { brand: { contains: q } },
      { model: { contains: q } },
      { referenceNumber: { contains: q } },
      { receiptNumber: { contains: q } },
    ];
  }
  if (range === "30d") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    where.createdAt = { gte: since };
  } else if (range === "month") {
    const now = new Date();
    where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  const [receipts, allCommissionRows] = await Promise.all([
    db.receipt.findMany({
      where,
      include: { customer: true, bankAccount: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.receipt.findMany({
      where: { commissionAmountCents: { not: null, gt: 0 } },
      select: { soldBy: true, commissionAmountCents: true },
    }),
  ]);

  const totalSales = receipts.reduce((sum, r) => sum + r.totalCents, 0);

  // commissions in the current filtered view
  const commissionInView = receipts.reduce<Record<string, number>>((acc, r) => {
    if (r.commissionAmountCents) {
      acc[r.soldBy] = (acc[r.soldBy] ?? 0) + r.commissionAmountCents;
    }
    return acc;
  }, {});

  // commissions across ALL time (the "owed" tally — independent of filter)
  const commissionOwed = allCommissionRows.reduce<Record<string, number>>((acc, r) => {
    if (r.commissionAmountCents) {
      acc[r.soldBy] = (acc[r.soldBy] ?? 0) + r.commissionAmountCents;
    }
    return acc;
  }, {});
  const owedEntries = Object.entries(commissionOwed).filter(([, c]) => c > 0);
  const totalOwed = owedEntries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="min-h-full pb-16">
      <TopNav active="history" />
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">History</h1>

        {owedEntries.length > 0 ? (
          <div className="mt-5 card-lift p-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-ink">Commission owed</h2>
              <span className="text-xs text-muted">across all sales</span>
            </div>
            <div className="mt-3 flex flex-col gap-2 nums">
              {owedEntries.map(([name, cents]) => (
                <div key={name} className="flex items-baseline justify-between">
                  <span className="text-base text-ink">{name}</span>
                  <span className="text-2xl font-semibold text-success">
                    {formatUSD(cents)}
                  </span>
                </div>
              ))}
              {owedEntries.length > 1 ? (
                <div className="flex items-baseline justify-between border-t border-divider pt-2 mt-1">
                  <span className="text-sm text-muted">Total owed</span>
                  <span className="text-base text-ink">{formatUSD(totalOwed)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          <form action="/history" method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search customer, ref #, model…"
              className="flex-1 bg-card border border-divider rounded-lg px-3 py-2.5 text-base outline-none focus:border-accent"
            />
            {range !== "all" ? <input type="hidden" name="range" value={range} /> : null}
            <button
              type="submit"
              className="bg-accent hover:bg-accent-deep text-white text-sm px-4 rounded-lg transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2 text-sm">
            <RangeChip current={range} value="all" q={q} label="All" />
            <RangeChip current={range} value="30d" q={q} label="Last 30 days" />
            <RangeChip current={range} value="month" q={q} label="This month" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm nums">
            <Stat label={range === "all" ? "Sales total" : "Sales in view"} value={String(receipts.length)} />
            <Stat label="Revenue" value={formatUSD(totalSales)} />
            {Object.entries(commissionInView)
              .filter(([, cents]) => cents > 0)
              .map(([name, cents]) => (
                <Stat
                  key={name}
                  label={`${name} commission${range === "all" ? "" : " in view"}`}
                  value={formatUSD(cents)}
                />
              ))}
          </div>
        </div>

        <ul className="mt-6 divide-y divide-divider border border-divider rounded-xl overflow-hidden bg-card">
          {receipts.length === 0 ? (
            <li className="p-8 text-center text-muted text-sm">No receipts yet.</li>
          ) : (
            receipts.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/history/${r.id}`}
                  className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3.5 hover:bg-divider-soft transition-colors"
                >
                  <div className="text-xs text-muted nums w-20 shrink-0">
                    {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                      r.createdAt,
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-ink truncate">{r.customer.name}</div>
                    <div className="text-xs text-muted truncate">
                      {r.brand} {r.model}
                      {r.referenceNumber ? ` · ${r.referenceNumber}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-ink nums">{formatUSD(r.totalCents)}</div>
                    <div className="text-xs text-muted">{r.soldBy}</div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </main>
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

function RangeChip({
  current,
  value,
  label,
  q,
}: {
  current: string;
  value: string;
  label: string;
  q: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (value !== "all") params.set("range", value);
  const href = `/history${params.toString() ? `?${params}` : ""}`;
  const active = current === value;
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full ${active ? "bg-accent text-white border-accent" : "bg-card border border-divider text-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );
}
