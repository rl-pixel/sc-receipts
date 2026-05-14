import type { OrderStatus } from "@/app/generated/prisma/client";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "PICKED",
  "SHIPPED",
  "DELIVERED",
  "RELEASED",
  "CANCELLED",
  "REFUNDED",
];

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PICKED", "CANCELLED", "REFUNDED"],
  PICKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["RELEASED", "REFUNDED"],
  RELEASED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "PAID", "PICKED", "SHIPPED"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PICKED: "Picked",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

// Tailwind-ish class strings for the status pill (bg + text)
export const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-divider-soft text-muted",
  PAID: "bg-accent-soft text-accent-deep",
  PICKED: "bg-gold-soft text-warn",
  SHIPPED: "bg-[#cffafe] text-[#0e7490]",
  DELIVERED: "bg-success-soft text-success-deep",
  RELEASED: "bg-[#bbf7d0] text-[#14532d]",
  CANCELLED: "bg-divider text-muted",
  REFUNDED: "bg-[#fee2e2] text-[#991b1b]",
};
