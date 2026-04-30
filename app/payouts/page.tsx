import Link from "next/link";
import { db } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { formatUSD } from "@/lib/money";
import { PayoutForm, PayoutDeleteButton } from "./Client";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const [sellers, receipts, payouts] = await Promise.all([
    db.seller.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.receipt.findMany({
      where: { commissionAmountCents: { not: null, gt: 0 } },
      select: { soldBy: true, commissionAmountCents: true },
    }),
    db.payout.findMany({ include: { seller: true }, orderBy: { paidAt: "desc" } }),
  ]);

  const earnedBySeller = receipts.reduce<Record<string, number>>((acc, r) => {
    if (r.commissionAmountCents) {
      acc[r.soldBy] = (acc[r.soldBy] ?? 0) + r.commissionAmountCents;
    }
    return acc;
  }, {});

  const paidBySeller = payouts.reduce<Record<string, number>>((acc, p) => {
    acc[p.seller.name] = (acc[p.seller.name] ?? 0) + p.amountCents;
    return acc;
  }, {});

  const sellerNames = sellers
    .filter((s) => (earnedBySeller[s.name] ?? 0) > 0 || (paidBySeller[s.name] ?? 0) > 0)
    .map((s) => s.name);

  return (
    <div className="min-h-full pb-28 sm:pb-16">
      <TopNav active="payouts" />
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Payouts</h1>
        <p className="text-sm text-muted mt-1">
          Track what you've paid Jacob (and anyone else who sold).
        </p>

        {sellerNames.length === 0 ? (
          <div className="mt-6 card-lift p-6 text-sm text-muted">
            No commission has been recorded on any sale yet. Set commission on a receipt
            (in <Link href="/" className="text-accent">New receipt</Link>) — it'll show up
            here.
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {sellerNames.map((name) => {
              const earned = earnedBySeller[name] ?? 0;
              const paid = paidBySeller[name] ?? 0;
              const owed = earned - paid;
              return (
                <div key={name} className="card-lift p-5">
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <h2 className="text-base font-semibold text-ink">{name}</h2>
                    <span
                      className={`text-2xl font-semibold nums ${owed > 0 ? "text-success" : "text-muted"}`}
                    >
                      {formatUSD(owed)} owed
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm nums">
                    <div className="bg-divider-soft border border-divider rounded-lg px-3 py-2">
                      <div className="text-xs text-muted">Earned (all time)</div>
                      <div className="text-ink">{formatUSD(earned)}</div>
                    </div>
                    <div className="bg-divider-soft border border-divider rounded-lg px-3 py-2">
                      <div className="text-xs text-muted">Paid out</div>
                      <div className="text-ink">{formatUSD(paid)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <PayoutForm sellerName={name} owed={owed} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {payouts.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-base font-semibold text-ink mb-3">Payment history</h2>
            <ul className="card-lift divide-y divide-divider overflow-hidden">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm text-ink">
                      Paid <span className="font-medium">{p.seller.name}</span>{" "}
                      <span className="nums">{formatUSD(p.amountCents)}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(p.paidAt)}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </div>
                  </div>
                  <PayoutDeleteButton id={p.id} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </main>
      <BottomNav active="payouts" />
    </div>
  );
}
