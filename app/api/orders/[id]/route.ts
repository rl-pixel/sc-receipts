import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canTransition } from "@/lib/order-status";
import type { OrderStatus } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      events: { orderBy: { createdAt: "desc" } },
      assignedToSeller: true,
      receipt: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

type PatchBody = {
  status?: OrderStatus;
  trackingNumber?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  pickedAt?: string | null;
  paymentConfirmedAt?: string | null;
  payoutReceivedAt?: string | null;
  escrowReleaseDate?: string | null;
  notes?: string | null;
  priorityFlag?: boolean;
  assignedToSellerId?: string | null;
  noteMessage?: string | null;
  actor?: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as PatchBody;

  const existing = await db.order.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  let nextStatus: OrderStatus = existing.status;

  if (body.status && body.status !== existing.status) {
    if (!canTransition(existing.status, body.status)) {
      return NextResponse.json(
        { error: `Invalid transition: ${existing.status} → ${body.status}` },
        { status: 400 },
      );
    }
    nextStatus = body.status;
    data.status = body.status;
  }

  if (body.trackingNumber !== undefined) {
    data.trackingNumber = body.trackingNumber || null;
    if (body.trackingNumber && !existing.shippedAt && !body.shippedAt) {
      data.shippedAt = new Date();
      if (existing.status === "PICKED" && !body.status) {
        if (canTransition(existing.status, "SHIPPED")) {
          data.status = "SHIPPED";
          nextStatus = "SHIPPED";
        }
      }
    }
  }
  if (body.carrier !== undefined) data.carrier = body.carrier || null;
  if (body.trackingUrl !== undefined) data.trackingUrl = body.trackingUrl || null;
  if (body.shippedAt !== undefined) {
    data.shippedAt = body.shippedAt ? new Date(body.shippedAt) : null;
  }
  if (body.pickedAt !== undefined) {
    data.pickedAt = body.pickedAt ? new Date(body.pickedAt) : null;
  }

  if (body.deliveredAt !== undefined) {
    data.deliveredAt = body.deliveredAt ? new Date(body.deliveredAt) : null;
    if (body.deliveredAt && existing.status === "SHIPPED" && !body.status) {
      data.status = "DELIVERED";
      nextStatus = "DELIVERED";
    }
  }

  if (body.paymentConfirmedAt !== undefined) {
    data.paymentConfirmedAt = body.paymentConfirmedAt
      ? new Date(body.paymentConfirmedAt)
      : null;
  }
  if (body.payoutReceivedAt !== undefined) {
    data.payoutReceivedAt = body.payoutReceivedAt ? new Date(body.payoutReceivedAt) : null;
  }
  if (body.escrowReleaseDate !== undefined) {
    data.escrowReleaseDate = body.escrowReleaseDate
      ? new Date(body.escrowReleaseDate)
      : null;
  }

  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.priorityFlag !== undefined) data.priorityFlag = body.priorityFlag;
  if (body.assignedToSellerId !== undefined) {
    data.assignedToSellerId = body.assignedToSellerId || null;
  }

  // Auto-set timestamps when status moves forward
  if (nextStatus === "PICKED" && !existing.pickedAt && data.pickedAt === undefined) {
    data.pickedAt = new Date();
  }
  if (nextStatus === "SHIPPED" && !existing.shippedAt && data.shippedAt === undefined) {
    data.shippedAt = new Date();
  }
  if (nextStatus === "DELIVERED" && !existing.deliveredAt && data.deliveredAt === undefined) {
    data.deliveredAt = new Date();
  }

  const actor = body.actor || "user";

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id }, data });

    if (nextStatus !== existing.status) {
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: nextStatus,
          actor,
          message: body.noteMessage || null,
        },
      });
    } else if (body.trackingNumber && body.trackingNumber !== existing.trackingNumber) {
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "TRACKING_ADDED",
          actor,
          message: `Tracking ${body.trackingNumber}${body.carrier ? ` via ${body.carrier}` : ""}`,
        },
      });
    } else if (body.noteMessage) {
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "NOTE",
          actor,
          message: body.noteMessage,
        },
      });
    }

    return u;
  });

  const full = await db.order.findUnique({
    where: { id: updated.id },
    include: {
      customer: true,
      events: { orderBy: { createdAt: "desc" } },
      assignedToSeller: true,
      receipt: true,
    },
  });
  return NextResponse.json(full);
}
