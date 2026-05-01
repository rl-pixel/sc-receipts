"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatUSD } from "@/lib/money";

type Stats = {
  week: { revenueCents: number; count: number };
  lastWeek: { revenueCents: number; count: number };
  today: { revenueCents: number; count: number };
};

export function StatsHero() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data: Stats = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const week = stats?.week ?? { revenueCents: 0, count: 0 };
  const lastWeek = stats?.lastWeek ?? { revenueCents: 0, count: 0 };

  const delta =
    lastWeek.revenueCents > 0
      ? ((week.revenueCents - lastWeek.revenueCents) / lastWeek.revenueCents) * 100
      : null;
  const isUp = (delta ?? 0) >= 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-deep text-white p-5 shadow-md overflow-hidden relative">
      <div className="text-[11px] uppercase tracking-wider font-medium opacity-80">
        Last 7 days
      </div>
      <div className="flex items-baseline gap-3 mt-1 nums">
        <CountUp valueCents={week.revenueCents} className="text-3xl sm:text-4xl font-bold tracking-tight" />
        {delta !== null ? (
          <span
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isUp ? "bg-success/30 text-white" : "bg-white/20 text-white"
            }`}
          >
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(Math.round(delta))}%
          </span>
        ) : null}
      </div>
      <div className="text-sm opacity-80 mt-1">
        {week.count} {week.count === 1 ? "sale" : "sales"} ·{" "}
        {lastWeek.count > 0
          ? `${formatUSD(lastWeek.revenueCents)} prior week`
          : "first week tracked"}
      </div>
    </div>
  );
}

function CountUp({ valueCents, className }: { valueCents: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (valueCents === 0) {
      setDisplay(0);
      return;
    }
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(valueCents * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valueCents]);
  return <span className={className}>{formatUSD(display)}</span>;
}
