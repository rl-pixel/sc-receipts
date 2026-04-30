import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { BottomNav } from "@/components/BottomNav";
import { formatUSD } from "@/lib/money";
import { ReceiptDetailActions } from "./Actions";

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ just_created?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const justCreated = sp.just_created === "1";

  const receipt = await db.receipt.findUnique({
    where: { id },
    include: { customer: true, bankAccount: true },
  });
  if (!receipt) notFound();

  const pdfUrl = `/api/receipts/${receipt.id}/pdf`;

  return (
    <div className="min-h-full pb-28 sm:pb-16">
      <TopNav active="history" />
      <main className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between text-sm">
          {justCreated ? (
            <span className="text-success font-medium">✓ Receipt saved</span>
          ) : (
            <Link href="/history" className="text-muted hover:text-ink">
              ← History
            </Link>
          )}
          <span className="text-muted nums">{receipt.receiptNumber}</span>
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">
          {receipt.customer.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold text-ink nums">
            {formatUSD(receipt.totalCents)}
          </span>
          <span className="text-muted text-sm">{receipt.customer.email}</span>
        </div>

        <div className="mt-5">
          <ReceiptDetailActions
            id={receipt.id}
            email={receipt.customer.email}
            receiptNumber={receipt.receiptNumber}
          />
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <Card>
            <Detail label="Watch" value={`${receipt.brand} ${receipt.model}`} />
            <Detail label="Reference" value={receipt.referenceNumber || "—"} />
            <Detail label="Year" value={receipt.year ? String(receipt.year) : "—"} />
            <Detail label="Condition" value={receipt.condition} />
            <Detail
              label="Box / Papers"
              value={
                [receipt.hasBox ? "Box" : null, receipt.hasPapers ? "Papers" : null]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
            {receipt.serial ? <Detail label="Serial" value={receipt.serial} /> : null}
          </Card>
          <Card>
            <Detail label="Subtotal" value={formatUSD(receipt.subtotalCents)} />
            <Detail label="Shipping" value={formatUSD(receipt.shippingCents)} />
            <Detail label="Tax" value={formatUSD(receipt.taxCents)} />
            <div className="border-t border-divider my-2" />
            <Detail
              label="Total paid"
              value={
                <span className="text-xl font-semibold">
                  {formatUSD(receipt.totalCents)}
                </span>
              }
            />
            <Detail
              label="Method"
              value={`${receipt.paymentMethod}${receipt.paymentSender ? ` · ${receipt.paymentSender}` : ""}`}
            />
            {receipt.paymentConfirmation ? (
              <Detail label="Confirmation" value={receipt.paymentConfirmation} />
            ) : null}
            {receipt.bankAccount ? (
              <Detail label="Deposited to" value={receipt.bankAccount.label} />
            ) : null}
            <Detail label="Sold by" value={receipt.soldBy} />
            {receipt.commissionAmountCents ? (
              <Detail
                label={`Owed to ${receipt.soldBy}`}
                value={
                  <span className="text-success">
                    {formatUSD(receipt.commissionAmountCents)}
                    {receipt.commissionType === "percent" && receipt.commissionValue != null
                      ? ` (${receipt.commissionValue}%)`
                      : ""}
                  </span>
                }
              />
            ) : null}
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="text-sm text-muted font-medium mb-3">Receipt PDF</h2>
          <div className="bg-card border border-divider rounded-xl overflow-hidden">
            <iframe
              src={pdfUrl}
              className="w-full"
              style={{ height: "min(80vh, 900px)" }}
              title="Receipt PDF"
            />
          </div>
        </div>
      </main>
      <BottomNav active="history" />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-divider rounded-xl p-4 flex flex-col gap-2 nums">
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
