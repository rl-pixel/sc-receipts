import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
      receipts: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    vipFlag?: boolean;
    notes?: string | null;
    name?: string;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  };
  const data: Record<string, unknown> = {};
  for (const k of ["vipFlag", "notes", "name", "phone", "street", "city", "state", "zip", "country"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  const customer = await db.customer.update({ where: { id }, data });
  return NextResponse.json(customer);
}
