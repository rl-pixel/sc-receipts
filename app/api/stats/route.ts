import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export async function GET() {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const dayMs = 24 * 60 * 60 * 1000;

    // ISO week (Mon start) — Joe's "this week" probably means rolling 7 days; simpler.
    const weekStart = new Date(today.getTime() - 6 * dayMs);
    const lastWeekStart = new Date(today.getTime() - 13 * dayMs);
    const lastWeekEnd = weekStart;

    const [thisWeek, lastWeek, todays] = await Promise.all([
      db.receipt.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { totalCents: true },
      }),
      db.receipt.findMany({
        where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd } },
        select: { totalCents: true },
      }),
      db.receipt.findMany({
        where: { createdAt: { gte: today } },
        select: { totalCents: true },
      }),
    ]);

    const sumCents = (rs: { totalCents: number }[]) =>
      rs.reduce((s, r) => s + r.totalCents, 0);

    return NextResponse.json({
      week: { revenueCents: sumCents(thisWeek), count: thisWeek.length },
      lastWeek: { revenueCents: sumCents(lastWeek), count: lastWeek.length },
      today: { revenueCents: sumCents(todays), count: todays.length },
    });
  } catch {
    return NextResponse.json({
      week: { revenueCents: 0, count: 0 },
      lastWeek: { revenueCents: 0, count: 0 },
      today: { revenueCents: 0, count: 0 },
    });
  }
}
