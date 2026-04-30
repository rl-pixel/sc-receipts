import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sellers = await db.seller.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(sellers);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const seller = await db.seller.create({
    data: {
      name: body.name,
      defaultCommissionType: body.defaultCommissionType ?? null,
      defaultCommissionValue:
        body.defaultCommissionValue != null ? Number(body.defaultCommissionValue) : null,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(seller, { status: 201 });
}
