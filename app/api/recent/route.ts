import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RecentCustomer, RecentWatch } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const recentReceipts = await db.receipt.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const watchMap = new Map<string, RecentWatch>();
  for (const r of recentReceipts) {
    const key = `${r.brand}|${r.model}|${r.referenceNumber ?? ""}`.toLowerCase();
    const existing = watchMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      watchMap.set(key, {
        brand: r.brand,
        model: r.model,
        referenceNumber: r.referenceNumber,
        year: r.year,
        condition: r.condition,
        hasBox: r.hasBox,
        hasPapers: r.hasPapers,
        count: 1,
      });
    }
    if (watchMap.size >= 8) break;
  }

  const customerMap = new Map<string, RecentCustomer>();
  for (const r of recentReceipts) {
    if (customerMap.has(r.customer.id)) continue;
    customerMap.set(r.customer.id, {
      id: r.customer.id,
      name: r.customer.name,
      email: r.customer.email,
      street: r.customer.street,
      city: r.customer.city,
      state: r.customer.state,
      zip: r.customer.zip,
      lastSoldAt: r.createdAt.toISOString(),
    });
    if (customerMap.size >= 6) break;
  }

  return NextResponse.json({
    watches: Array.from(watchMap.values()),
    customers: Array.from(customerMap.values()),
  });
}
