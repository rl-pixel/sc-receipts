import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOrderNumber } from "@/lib/order-number";
import { ACTIVE_STATUSES } from "@/lib/order-status";
import { requireIngestKey } from "@/lib/auth";
import type { OrderStatus, OrderSource, Prisma } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

type CreateBody = {
  externalOrderId?: string | null;
  source?: OrderSource;
  customer: {
    email: string;
    name: string;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  };
  watch: {
    brand: string;
    model: string;
    referenceNumber?: string | null;
    year?: number | null;
    condition?: string | null;
    hasBox?: boolean;
    hasPapers?: boolean;
    serial?: string | null;
  };
  money: {
    saleCents: number;
    shippingCents?: number;
    taxCents?: number;
    c24FeeCents?: number;
    netToUsCents?: number;
    currency?: string;
  };
  paymentMethod?: string;
  paymentConfirmedAt?: string | null;
  escrowReleaseDate?: string | null;
  assignedToSellerId?: string | null;
  notes?: string | null;
  priorityFlag?: boolean;
  actor?: string | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const customerId = url.searchParams.get("customerId");
  const assignedTo = url.searchParams.get("assignedTo");
  const priorityParam = url.searchParams.get("priority");
  const q = (url.searchParams.get("q") ?? "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const sort = url.searchParams.get("sort") ?? "default";

  const where: Prisma.OrderWhereInput = {};

  if (statusParam) {
    const list = statusParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as OrderStatus[];
    if (list.length) where.status = { in: list };
  } else {
    where.status = { in: ACTIVE_STATUSES };
  }

  if (customerId) where.customerId = customerId;
  if (assignedTo) where.assignedToSellerId = assignedTo;
  if (priorityParam === "true") where.priorityFlag = true;

  if (q) {
    where.OR = [
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { brand: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { referenceNumber: { contains: q, mode: "insensitive" } },
      { orderNumber: { contains: q, mode: "insensitive" } },
      { externalOrderId: { contains: q, mode: "insensitive" } },
    ];
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  let orderBy: Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[];
  switch (sort) {
    case "created":
      orderBy = { createdAt: "desc" };
      break;
    case "priority":
      orderBy = [{ priorityFlag: "desc" }, { createdAt: "desc" }];
      break;
    case "escrowDate":
      orderBy = { escrowReleaseDate: "asc" };
      break;
    case "value":
      orderBy = { saleCents: "desc" };
      break;
    default:
      orderBy = [{ priorityFlag: "desc" }, { createdAt: "asc" }];
  }

  const orders = await db.order.findMany({
    where,
    orderBy,
    include: {
      customer: true,
      events: { orderBy: { createdAt: "desc" }, take: 3 },
      assignedToSeller: true,
    },
    take: 200,
  });

  const totalCents = orders.reduce((s, o) => s + o.saleCents, 0);
  const byStatusRows = await db.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) byStatus[row.status] = row._count._all;

  return NextResponse.json({
    orders,
    totalCents,
    count: orders.length,
    byStatus,
  });
}

export async function POST(request: Request) {
  const auth = requireIngestKey(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json()) as CreateBody;

  if (!body?.customer?.email || !body?.customer?.name) {
    return NextResponse.json(
      { error: "customer.email and customer.name are required" },
      { status: 400 },
    );
  }
  if (!body?.watch?.brand || !body?.watch?.model) {
    return NextResponse.json(
      { error: "watch.brand and watch.model are required" },
      { status: 400 },
    );
  }
  if (typeof body?.money?.saleCents !== "number") {
    return NextResponse.json({ error: "money.saleCents is required" }, { status: 400 });
  }

  if (body.externalOrderId) {
    const existing = await db.order.findUnique({
      where: { externalOrderId: body.externalOrderId },
      include: { customer: true, events: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Order already exists", order: existing }, { status: 409 });
    }
  }

  const email = body.customer.email.toLowerCase();
  const source = body.source ?? "CHRONO24";
  const paymentConfirmedAt = body.paymentConfirmedAt ? new Date(body.paymentConfirmedAt) : null;
  const escrowReleaseDate = body.escrowReleaseDate ? new Date(body.escrowReleaseDate) : null;
  const initialStatus: OrderStatus = paymentConfirmedAt ? "PAID" : "PENDING";

  const saleCents = body.money.saleCents;
  const shippingCents = body.money.shippingCents ?? 0;
  const taxCents = body.money.taxCents ?? 0;
  const c24FeeCents = body.money.c24FeeCents ?? 0;
  const netToUsCents = body.money.netToUsCents ?? saleCents - c24FeeCents;

  const orderNumber = await generateOrderNumber();
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email },
      update: {
        name: body.customer.name || undefined,
        phone: body.customer.phone || undefined,
        street: body.customer.street || undefined,
        city: body.customer.city || undefined,
        state: body.customer.state || undefined,
        zip: body.customer.zip || undefined,
        country: body.customer.country || undefined,
        lastOrderAt: now,
        totalOrders: { increment: 1 },
        totalSpentCents: { increment: saleCents },
      },
      create: {
        name: body.customer.name,
        email,
        phone: body.customer.phone || null,
        street: body.customer.street || null,
        city: body.customer.city || null,
        state: body.customer.state || null,
        zip: body.customer.zip || null,
        country: body.customer.country || "USA",
        source,
        firstOrderAt: now,
        lastOrderAt: now,
        totalOrders: 1,
        totalSpentCents: saleCents,
      },
    });

    if (body.watch.brand) {
      await tx.brand.upsert({
        where: { name: body.watch.brand },
        update: { useCount: { increment: 1 } },
        create: { name: body.watch.brand, useCount: 1 },
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        externalOrderId: body.externalOrderId || null,
        source,
        status: initialStatus,
        customerId: customer.id,
        brand: body.watch.brand,
        model: body.watch.model,
        referenceNumber: body.watch.referenceNumber || null,
        year: body.watch.year ?? null,
        condition: body.watch.condition || "New",
        hasBox: body.watch.hasBox ?? false,
        hasPapers: body.watch.hasPapers ?? false,
        serial: body.watch.serial || null,
        saleCents,
        shippingCents,
        taxCents,
        c24FeeCents,
        netToUsCents,
        currency: body.money.currency || "USD",
        paymentMethod: body.paymentMethod || "Chrono24Escrow",
        paymentConfirmedAt,
        escrowReleaseDate,
        assignedToSellerId: body.assignedToSellerId || null,
        notes: body.notes || null,
        priorityFlag: body.priorityFlag ?? false,
      },
      include: { customer: true, events: true, assignedToSeller: true },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "STATUS_CHANGED",
        toStatus: initialStatus,
        actor: body.actor || "system",
        message: `Order created (${initialStatus.toLowerCase()})`,
      },
    });

    return order;
  });

  const created = await db.order.findUnique({
    where: { id: result.id },
    include: {
      customer: true,
      events: { orderBy: { createdAt: "desc" } },
      assignedToSeller: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
