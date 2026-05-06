import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://api.mercury.com/api/v1";

// Mercury calls invoices "payment requests" in their API.
type RawPaymentRequest = {
  paymentRequestData: {
    id: string;
    createdAt: string;
    updatedAt: string;
    dueDate: string | null;
    expiresAt: string | null;
    amount: number;
    status: string; // "Sent" | "Paid" | "Cancelled" | "Expired" | etc.
    notes?: string | null;
    organizationName?: string;
    addressesToEmail?: string[];
    publicSlug?: string;
  };
  recipientData: Array<{
    id: string;
    email: string | null;
    name: string | null;
  }>;
};

export type MercuryInvoice = {
  id: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  amount: number;
  status: string;
  notes: string | null;
  recipient: { name: string | null; email: string | null };
};

export async function GET() {
  const token = process.env.MERCURY_API_KEY;
  if (!token) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    const res = await fetch(`${BASE}/payment-requests`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json([]);
    const body = (await res.json()) as { paymentRequests?: RawPaymentRequest[] };
    const list = body.paymentRequests ?? [];
    // Show ALL statuses (Sent, Paid, Cancelled, Expired, etc.) — Joe wants to
    // be able to find any invoice he made and turn it into a receipt. The
    // status pill in the UI makes it visually clear which is which.
    const cleaned: MercuryInvoice[] = list
      .map((p) => ({
        id: p.paymentRequestData.id,
        createdAt: p.paymentRequestData.createdAt,
        updatedAt: p.paymentRequestData.updatedAt,
        dueDate: p.paymentRequestData.dueDate,
        amount: p.paymentRequestData.amount,
        status: p.paymentRequestData.status,
        notes: p.paymentRequestData.notes ?? null,
        recipient: {
          name: p.recipientData?.[0]?.name ?? null,
          email: p.recipientData?.[0]?.email ?? null,
        },
      }))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    return NextResponse.json(cleaned);
  } catch {
    return NextResponse.json([]);
  }
}
