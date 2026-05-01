"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatUSD } from "@/lib/money";

type Receipt = {
  id: string;
  receiptNumber: string;
  brand: string;
  model: string;
  totalCents: number;
  soldBy: string;
  createdAt: string;
  customer: { name: string };
};

const palettes = [
  { from: "from-[#0052FF]", to: "to-[#1E3A8A]", text: "text-white", chip: "bg-white/20" },
  { from: "from-[#00C853]", to: "to-[#00701A]", text: "text-white", chip: "bg-white/20" },
  { from: "from-[#FFB300]", to: "to-[#FF6F00]", text: "text-white", chip: "bg-white/20" },
  { from: "from-[#7B61FF]", to: "to-[#3D2A99]", text: "text-white", chip: "bg-white/20" },
  { from: "from-[#FF3B82]", to: "to-[#A8235C]", text: "text-white", chip: "bg-white/20" },
];

export function RecentSales() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    void fetch("/api/receipts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setReceipts)
      .catch(() => {});
  }, []);

  if (receipts.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-ink">Recent sales</h2>
        <Link
          href="/history"
          className="flex items-center gap-1 text-sm text-accent hover:text-accent-deep font-medium"
        >
          View all <ArrowRight size={14} />
        </Link>
      </div>
      <div className="-mx-4 px-4 overflow-x-auto">
        <div className="flex gap-3 pb-2">
          {receipts.slice(0, 8).map((r, i) => {
            const p = palettes[i % palettes.length];
            const date = new Date(r.createdAt);
            return (
              <Link
                key={r.id}
                href={`/history/${r.id}`}
                className={`shrink-0 w-44 sm:w-52 rounded-2xl bg-gradient-to-br ${p.from} ${p.to} ${p.text} p-4 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] hover:scale-[1.02] transition-transform`}
              >
                <div className={`text-[10px] ${p.chip} px-2 py-0.5 rounded-full inline-block font-medium`}>
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)}
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight nums">
                  {formatUSD(r.totalCents)}
                </div>
                <div className="mt-1 text-xs opacity-90 truncate">{r.customer.name}</div>
                <div className="text-xs opacity-80 truncate">
                  {r.brand} {r.model}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
