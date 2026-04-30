import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const seller = await db.seller.update({
    where: { id },
    data: {
      defaultCommissionType: body.defaultCommissionType ?? undefined,
      defaultCommissionValue:
        body.defaultCommissionValue != null ? Number(body.defaultCommissionValue) : undefined,
      sortOrder: body.sortOrder ?? undefined,
      active: body.active ?? undefined,
    },
  });
  return NextResponse.json(seller);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.seller.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
