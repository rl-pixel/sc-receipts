import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await db.receipt.findUnique({
    where: { id },
    include: { customer: true, bankAccount: true },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(receipt);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.receipt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
