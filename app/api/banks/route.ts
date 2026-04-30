import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const banks = await db.bankAccount.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(banks);
}

export async function POST(request: Request) {
  const body = await request.json();
  const bank = await db.bankAccount.create({
    data: {
      label: body.label,
      bankName: body.bankName ?? null,
      last4: body.last4 ?? null,
      acceptsZelle: !!body.acceptsZelle,
      acceptsWire: body.acceptsWire ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(bank, { status: 201 });
}
