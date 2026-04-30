import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { ReceiptPdf } from "@/components/ReceiptPdf";
import type { ReceiptPdfData } from "@/lib/types";

export const runtime = "nodejs";

async function getBusinessSettings() {
  const settings = await db.appSetting.findMany({
    where: { key: { in: ["businessName", "businessLocation", "businessFooter", "businessWebsite"] } },
  });
  const m = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return {
    name: m.businessName ?? "Studio Chrono",
    location: m.businessLocation ?? "Miami, FL",
    website: m.businessWebsite ?? "studiochrono.com",
    footer: m.businessFooter ?? "5.0 ★ on Chrono24 · 315+ reviews",
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = await db.receipt.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!receipt) return new Response("Not found", { status: 404 });

  const business = await getBusinessSettings();

  const data: ReceiptPdfData = {
    receiptNumber: receipt.receiptNumber,
    issuedAt: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(receipt.createdAt),
    business,
    customer: {
      name: receipt.customer.name,
      email: receipt.customer.email,
      street: receipt.customer.street ?? "",
      city: receipt.customer.city ?? "",
      state: receipt.customer.state ?? "",
      zip: receipt.customer.zip ?? "",
    },
    watch: {
      brand: receipt.brand,
      model: receipt.model,
      referenceNumber: receipt.referenceNumber ?? "",
      year: receipt.year ? String(receipt.year) : "",
      condition: receipt.condition,
      hasBox: receipt.hasBox,
      hasPapers: receipt.hasPapers,
    },
    payment: {
      method: receipt.paymentMethod,
      sender: receipt.paymentSender ?? "",
      confirmation: receipt.paymentConfirmation ?? "",
      date: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(receipt.paymentDate),
    },
    totals: {
      subtotalCents: receipt.subtotalCents,
      shippingCents: receipt.shippingCents,
      taxCents: receipt.taxCents,
      totalCents: receipt.totalCents,
    },
  };

  const stream = await renderToStream(<ReceiptPdf data={data} />);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="StudioChrono_Receipt_${receipt.receiptNumber}.pdf"`,
    },
  });
}
