import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
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
    <div className="min-h-full pb-16">
      <TopNav active="history" />
      <main className="max-w-4xl mx-auto px-4 pt-6">
        {justCreated ? (
          <div className="mb-6 bg-card border border-success/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-success text-sm font-medium">✓ Receipt saved</div>
              <div className="text-xs text-muted mt-0.5">
                {receipt.receiptNumber} · {receipt.customer.email}
              </div>
            </div>
            <Link
              href="/"
              className="text-xs uppercase tracking-wider text-muted hover:text-ink"
            >
              New →
            </Link>
          </div>
        ) : (
          <Link
            href="/history"
            className="text-xs uppercase tracking-wider text-muted hover:text-ink"
          >
            ← History
          </Link>
        )}

        <div className="mt-4 grid md:grid-cols-[1fr_auto] gap-6 items-start">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">
              {receipt.receiptNumber}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl mt-1 tracking-tight">
              {receipt.customer.name}
            </h1>
            <p className="text-muted text-sm mt-1">{receipt.customer.email}</p>
          </div>
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
                <span className="font-[family-name:var(--font-display)] text-xl">
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
                label="Commission"
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
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted mb-3">
            Receipt PDF
          </h2>
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
      <span className="text-xs uppercase tracking-wider text-muted shrink-0">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
