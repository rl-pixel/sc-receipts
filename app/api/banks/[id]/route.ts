import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const bank = await db.bankAccount.update({
    where: { id },
    data: {
      label: body.label ?? undefined,
      bankName: body.bankName ?? undefined,
      last4: body.last4 ?? undefined,
      acceptsZelle: body.acceptsZelle ?? undefined,
      acceptsWire: body.acceptsWire ?? undefined,
      sortOrder: body.sortOrder ?? undefined,
      active: body.active ?? undefined,
    },
  });
  return NextResponse.json(bank);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.bankAccount.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
