import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last month, same window (1st through same day-of-month + same time)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthCutoff = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );

    const [thisMonth, lastMonthPartial, allMonths, sinceMonthStart] = await Promise.all([
      db.receipt.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { totalCents: true, createdAt: true },
      }),
      db.receipt.findMany({
        where: { createdAt: { gte: lastMonthStart, lt: lastMonthCutoff } },
        select: { totalCents: true },
      }),
      db.receipt.findMany({
        select: { totalCents: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.receipt.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const sumCents = (rs: { totalCents: number }[]) =>
      rs.reduce((s, r) => s + r.totalCents, 0);

    // Best month ever check
    const monthTotals = new Map<string, number>();
    for (const r of allMonths) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + r.totalCents);
    }
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthTotal = monthTotals.get(currentKey) ?? 0;
    const previousBest = Array.from(monthTotals.entries())
      .filter(([k]) => k !== currentKey)
      .reduce((m, [, v]) => Math.max(m, v), 0);
    const bestMonthEver = currentMonthTotal > 0 && currentMonthTotal > previousBest;

    // Streak: consecutive days ending today (or yesterday) with at least one sale
    const salesDates = new Set(sinceMonthStart.map((r) => ymd(r.createdAt)));
    // walk back from today
    let streak = 0;
    const cursor = new Date(today);
    while (salesDates.has(ymd(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return NextResponse.json({
      month: { revenueCents: sumCents(thisMonth), count: thisMonth.length },
      lastMonthThroughSameDay: {
        revenueCents: sumCents(lastMonthPartial),
        count: lastMonthPartial.length,
      },
      streak,
      bestMonthEver,
    });
  } catch {
    return NextResponse.json({
      month: { revenueCents: 0, count: 0 },
      lastMonthThroughSameDay: { revenueCents: 0, count: 0 },
      streak: 0,
      bestMonthEver: false,
    });
  }
}
