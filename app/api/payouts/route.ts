import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";

export const runtime = "nodejs";

export async function GET() {
  const payouts = await db.payout.findMany({
    include: { seller: true },
    orderBy: { paidAt: "desc" },
    take: 200,
  });
  return NextResponse.json(payouts);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sellerName: string;
    amountUsd: string | number;
    paidAt?: string;
    notes?: string;
  };

  const seller = await db.seller.findUnique({ where: { name: body.sellerName } });
  if (!seller) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }
  const amountCents = dollarsToCents(body.amountUsd);
  if (amountCents <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  const payout = await db.payout.create({
    data: {
      sellerId: seller.id,
      amountCents,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      notes: body.notes?.trim() || null,
    },
    include: { seller: true },
  });
  return NextResponse.json(payout, { status: 201 });
}
