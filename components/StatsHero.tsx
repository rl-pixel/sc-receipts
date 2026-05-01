"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Flame, Trophy } from "lucide-react";
import { formatUSD } from "@/lib/money";

type Stats = {
  month: { revenueCents: number; count: number };
  lastMonthThroughSameDay: { revenueCents: number; count: number };
  streak: number;
  bestMonthEver: boolean;
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

  const month = stats?.month ?? { revenueCents: 0, count: 0 };
  const last = stats?.lastMonthThroughSameDay ?? { revenueCents: 0, count: 0 };

  const delta =
    last.revenueCents > 0
      ? ((month.revenueCents - last.revenueCents) / last.revenueCents) * 100
      : null;
  const isUp = (delta ?? 0) >= 0;

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date());

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl bg-gradient-to-br from-accent to-accent-deep text-white p-6 shadow-[0_8px_24px_-8px_rgba(0,82,255,0.4)] relative overflow-hidden">
        <div className="text-sm font-medium opacity-80">{monthName}</div>
        <div className="flex items-baseline gap-3 mt-1 nums">
          <CountUp
            valueCents={month.revenueCents}
            className="text-3xl sm:text-4xl font-bold tracking-tight"
          />
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
          {month.count} {month.count === 1 ? "sale" : "sales"}
          {last.revenueCents > 0
            ? ` · ${formatUSD(last.revenueCents)} same time last month`
            : ""}
        </div>
      </div>

      {stats ? <Streaks streak={stats.streak} bestMonthEver={stats.bestMonthEver} /> : null}
    </div>
  );
}

function Streaks({ streak, bestMonthEver }: { streak: number; bestMonthEver: boolean }) {
  const items: { icon: React.ReactNode; bg: string; text: string; label: string }[] = [];

  if (streak >= 2) {
    items.push({
      icon: <Flame size={16} />,
      bg: "bg-orange-100",
      text: "text-orange-700",
      label: `${streak}-day streak`,
    });
  }
  if (bestMonthEver) {
    items.push({
      icon: <Trophy size={16} />,
      bg: "bg-gold-soft",
      text: "text-amber-700",
      label: "Best month ever",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it, i) => (
        <div
          key={i}
          className={`${it.bg} ${it.text} px-3 py-2 rounded-full inline-flex items-center gap-2 text-sm font-medium`}
        >
          {it.icon}
          {it.label}
        </div>
      ))}
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
    const duration = 800;
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
