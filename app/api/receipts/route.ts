import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";
import { generateReceiptNumber } from "@/lib/receipt-number";
import { resolveCommissionCents } from "@/lib/commission";
import type { FormState } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const range = url.searchParams.get("range") ?? "all";
  const brand = url.searchParams.get("brand") ?? "";

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { customer: { name: { contains: q } } },
      { customer: { email: { contains: q } } },
      { brand: { contains: q } },
      { model: { contains: q } },
      { referenceNumber: { contains: q } },
      { receiptNumber: { contains: q } },
    ];
  }
  if (brand) where.brand = brand;
  if (range === "30d") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    where.createdAt = { gte: since };
  } else if (range === "month") {
    const now = new Date();
    where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  const receipts = await db.receipt.findMany({
    where,
    include: { customer: true, bankAccount: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(receipts);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { form: FormState };
  const { form } = body;

  const subtotalCents = dollarsToCents(form.payment.amountUsd);
  const shippingCents = dollarsToCents(form.totals.shippingUsd);
  const taxCents = dollarsToCents(form.totals.taxUsd);
  const totalCents = subtotalCents + shippingCents + taxCents;

  const commissionAmountCents = resolveCommissionCents(
    form.seller.commissionType,
    form.seller.commissionValue ? Number(form.seller.commissionValue) : null,
    totalCents,
  );

  const paymentDate = form.payment.date ? new Date(form.payment.date) : new Date();
  const receiptNumber = await generateReceiptNumber();

  const customer = await db.customer.upsert({
    where: { email: form.customer.email.toLowerCase() },
    update: {
      name: form.customer.name || undefined,
      phone: form.customer.phone || undefined,
      street: form.customer.street || undefined,
      city: form.customer.city || undefined,
      state: form.customer.state || undefined,
      zip: form.customer.zip || undefined,
    },
    create: {
      name: form.customer.name,
      email: form.customer.email.toLowerCase(),
      phone: form.customer.phone || null,
      street: form.customer.street || null,
      city: form.customer.city || null,
      state: form.customer.state || null,
      zip: form.customer.zip || null,
    },
  });

  if (form.watch.brand) {
    await db.brand.upsert({
      where: { name: form.watch.brand },
      update: { useCount: { increment: 1 } },
      create: { name: form.watch.brand, useCount: 1 },
    });
  }

  const receipt = await db.receipt.create({
    data: {
      receiptNumber,
      customerId: customer.id,
      brand: form.watch.brand,
      model: form.watch.model,
      referenceNumber: form.watch.referenceNumber || null,
      year: form.watch.year ? Number(form.watch.year) : null,
      condition: form.watch.condition,
      hasBox: form.watch.hasBox,
      hasPapers: form.watch.hasPapers,
      serial: form.watch.serial || null,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      paymentMethod: form.payment.method,
      paymentSender: form.payment.sender || null,
      paymentConfirmation: form.payment.confirmation || null,
      paymentDate,
      bankAccountId: form.payment.bankAccountId || null,
      soldBy: form.seller.soldBy,
      commissionType: form.seller.commissionType,
      commissionValue: form.seller.commissionValue ? Number(form.seller.commissionValue) : null,
      commissionAmountCents,
      notes: form.notes || null,
    },
    include: { customer: true, bankAccount: true },
  });

  return NextResponse.json(receipt, { status: 201 });
}
