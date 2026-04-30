import Link from "next/link";
import { db } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
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

  let receipts: Awaited<
    ReturnType<typeof db.receipt.findMany<{ include: { customer: true; bankAccount: true } }>>
  > = [];
  let allCommissionRows: { soldBy: string; commissionAmountCents: number | null }[] = [];
  let allPayouts: Awaited<ReturnType<typeof db.payout.findMany<{ include: { seller: true } }>>> = [];
  let dbError = false;
  try {
    [receipts, allCommissionRows, allPayouts] = await Promise.all([
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
      db.payout.findMany({ include: { seller: true } }),
    ]);
  } catch {
    dbError = true;
  }

  const totalSales = receipts.reduce((sum, r) => sum + r.totalCents, 0);

  const earnedAllTime = allCommissionRows.reduce<Record<string, number>>((acc, r) => {
    if (r.commissionAmountCents) {
      acc[r.soldBy] = (acc[r.soldBy] ?? 0) + r.commissionAmountCents;
    }
    return acc;
  }, {});
  const paidAllTime = allPayouts.reduce<Record<string, number>>((acc, p) => {
    acc[p.seller.name] = (acc[p.seller.name] ?? 0) + p.amountCents;
    return acc;
  }, {});
  const owedBySeller: Record<string, number> = {};
  for (const name of new Set([...Object.keys(earnedAllTime), ...Object.keys(paidAllTime)])) {
    const owed = (earnedAllTime[name] ?? 0) - (paidAllTime[name] ?? 0);
    if (owed > 0) owedBySeller[name] = owed;
  }

  return (
    <div className="min-h-full pb-28 sm:pb-16">
      <TopNav active="history" />
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">History</h1>

        {dbError ? (
          <div className="mt-5 card-lift p-4 text-sm text-warn">
            Couldn't reach the database. Check that <code className="font-mono">DATABASE_URL</code>{" "}
            is set in <code className="font-mono">.env</code> (locally) or in Vercel env vars (production).
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
            {Object.entries(owedBySeller).map(([name, cents]) => (
              <Link
                key={name}
                href="/payouts"
                className="bg-card border border-divider rounded-lg px-3 py-2 hover:border-accent transition-colors"
              >
                <div className="text-xs text-muted">Owed to {name}</div>
                <div className="text-success text-base">{formatUSD(cents)}</div>
              </Link>
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
      <BottomNav active="history" />
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
