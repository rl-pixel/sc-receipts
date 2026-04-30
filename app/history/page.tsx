import Link from "next/link";
import { db } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { formatUSD } from "@/lib/money";

type SP = {
  q?: string;
  range?: string;
  brand?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const range = sp.range ?? "all";
  const brand = sp.brand ?? "";

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
  if (brand) where.brand = brand;
  if (range === "30d") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    where.createdAt = { gte: since };
  } else if (range === "month") {
    const now = new Date();
    where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  const [receipts, brands] = await Promise.all([
    db.receipt.findMany({
      where,
      include: { customer: true, bankAccount: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.brand.findMany({ orderBy: { useCount: "desc" }, take: 12 }),
  ]);

  const totalSales = receipts.reduce((sum, r) => sum + r.totalCents, 0);
  const commissionByPerson = receipts.reduce<Record<string, number>>((acc, r) => {
    if (r.commissionAmountCents) {
      acc[r.soldBy] = (acc[r.soldBy] ?? 0) + r.commissionAmountCents;
    }
    return acc;
  }, {});

  return (
    <div className="min-h-full pb-16">
      <TopNav active="history" />
      <main className="max-w-4xl mx-auto px-4 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">History</h1>

        <div className="mt-6 flex flex-col gap-4">
          <form action="/history" method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search customer, ref #, model…"
              className="flex-1 bg-card border border-divider rounded-lg px-3 py-2.5 text-base outline-none focus:border-ink"
            />
            {range !== "all" ? <input type="hidden" name="range" value={range} /> : null}
            {brand ? <input type="hidden" name="brand" value={brand} /> : null}
            <button
              type="submit"
              className="bg-accent hover:bg-accent-deep text-white text-sm px-4 rounded-lg transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-2 text-xs">
            <RangeChip current={range} value="all" q={q} brand={brand} label="All" />
            <RangeChip current={range} value="30d" q={q} brand={brand} label="Last 30 days" />
            <RangeChip current={range} value="month" q={q} brand={brand} label="This month" />
            {brands.length > 0 ? <span className="px-1 text-muted">·</span> : null}
            {brands.map((b) => (
              <BrandChip key={b.id} current={brand} value={b.name} q={q} range={range} />
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm nums">
            <Stat label="Sales" value={String(receipts.length)} />
            <Stat label="Total" value={formatUSD(totalSales)} />
            {Object.entries(commissionByPerson)
              .filter(([, cents]) => cents > 0)
              .map(([name, cents]) => (
                <Stat key={name} label={`Commission owed to ${name}`} value={formatUSD(cents)} />
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
                  className="grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-3.5 hover:bg-divider/40 transition-colors"
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
                    <div className="text-xs text-muted">
                      {r.soldBy}
                    </div>
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
  brand,
}: {
  current: string;
  value: string;
  label: string;
  q: string;
  brand: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (value !== "all") params.set("range", value);
  if (brand) params.set("brand", brand);
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

function BrandChip({
  current,
  value,
  q,
  range,
}: {
  current: string;
  value: string;
  q: string;
  range: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (range !== "all") params.set("range", range);
  const active = current === value;
  if (!active) params.set("brand", value);
  const href = `/history${params.toString() ? `?${params}` : ""}`;
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full ${active ? "bg-accent text-white border-accent" : "bg-card border border-divider text-muted hover:text-ink"}`}
    >
      {value}
    </Link>
  );
}
