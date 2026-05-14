import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateReceiptNumber } from "@/lib/receipt-number";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    soldBy?: string;
    bankAccountId?: string | null;
    actor?: string | null;
  };

  const order = await db.order.findUnique({
    where: { id },
    include: { customer: true, receipt: true, assignedToSeller: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.receiptId) {
    return NextResponse.json(
      { error: "Order already has a receipt", receiptId: order.receiptId },
      { status: 409 },
    );
  }

  const subtotalCents = order.saleCents;
  const shippingCents = order.shippingCents;
  const taxCents = order.taxCents;
  const totalCents = subtotalCents + shippingCents + taxCents;

  const soldBy = body.soldBy || order.assignedToSeller?.name || "Joe";
  const receiptNumber = await generateReceiptNumber();

  const receipt = await db.$transaction(async (tx) => {
    const r = await tx.receipt.create({
      data: {
        receiptNumber,
        customerId: order.customerId,
        brand: order.brand,
        model: order.model,
        referenceNumber: order.referenceNumber,
        year: order.year,
        condition: order.condition,
        hasBox: order.hasBox,
        hasPapers: order.hasPapers,
        serial: order.serial,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        paymentMethod: order.paymentMethod,
        paymentSender: order.customer.name,
        paymentDate: order.paymentConfirmedAt ?? order.createdAt,
        bankAccountId: body.bankAccountId || null,
        soldBy,
        notes: order.notes,
      },
      include: { customer: true, bankAccount: true },
    });

    await tx.order.update({ where: { id: order.id }, data: { receiptId: r.id } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "RECEIPT_GENERATED",
        actor: body.actor || soldBy,
        message: `Receipt ${r.receiptNumber} generated`,
      },
    });
    return r;
  });

  return NextResponse.json(
    {
      receipt,
      pdfUrl: `/api/receipts/${receipt.id}/pdf`,
      detailUrl: `/history/${receipt.id}`,
    },
    { status: 201 },
  );
}
