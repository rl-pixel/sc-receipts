import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReceiptPdfData } from "@/lib/types";

const PAPER = {
  bg: "#FFFFFF",
  ink: "#0A0A0A",
  muted: "#6B6B6B",
  divider: "#E5E5E5",
  successText: "#0F7A3A",
  successBg: "#E8F5EE",
};

const SP = {
  pageX: 56,
  pageY: 50,
  block: 22,
  blockSm: 16,
  rowGap: 10,
  rowGapSm: 6,
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAPER.bg,
    color: PAPER.ink,
    paddingHorizontal: SP.pageX,
    paddingVertical: SP.pageY,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 3.2,
    textTransform: "uppercase",
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: PAPER.divider,
    marginVertical: SP.block,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  receiptHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 1.1,
  },
  receiptMeta: {
    fontSize: 9.5,
    color: PAPER.muted,
    marginTop: 6,
  },
  receiptId: {
    fontSize: 10,
    color: PAPER.ink,
    fontFamily: "Helvetica",
    textAlign: "right",
  },
  paidPill: {
    flexDirection: "row",
    alignSelf: "flex-end",
    backgroundColor: PAPER.successBg,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  paidText: {
    color: PAPER.successText,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
  },
  twoCol: {
    flexDirection: "row",
    gap: 48,
  },
  colHeader: {
    fontSize: 8,
    color: PAPER.muted,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  colBody: {
    fontSize: 10,
    color: PAPER.ink,
  },
  colMuted: {
    fontSize: 10,
    color: PAPER.muted,
    lineHeight: 1.55,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  itemTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  itemMeta: {
    fontSize: 9.5,
    color: PAPER.muted,
    marginTop: 4,
  },
  amount: {
    fontSize: 11.5,
    fontFamily: "Helvetica",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  totalsLabel: {
    fontSize: 10,
    color: PAPER.muted,
  },
  totalsValue: {
    fontSize: 10,
    color: PAPER.ink,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: PAPER.divider,
    marginTop: 10,
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    letterSpacing: -0.2,
  },
  paidLine: {
    fontSize: 9.5,
    color: PAPER.muted,
    marginTop: 12,
  },
  thankYou: {
    fontSize: 10.5,
    color: PAPER.ink,
    lineHeight: 1.6,
  },
  signature: {
    fontSize: 10.5,
    color: PAPER.ink,
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    fontSize: 9,
    color: PAPER.muted,
  },
});

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function ReceiptPdf({ data }: { data: ReceiptPdfData }) {
  const { customer, watch, payment, totals, receiptNumber, issuedAt, soldBy, business } = data;
  const shipFull = customer.addressLines
    ? customer.addressLines
    : [customer.street, [customer.city, customer.state].filter(Boolean).join(", "), customer.zip]
        .filter(Boolean)
        .join("\n");

  return (
    <Document
      title={`Studio Chrono Receipt ${receiptNumber}`}
      author="Studio Chrono"
      subject="Receipt"
    >
      <Page size="LETTER" wrap={false} style={styles.page}>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.wordmark}>Studio Chrono</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.receiptHeader}>Receipt</Text>
            <Text style={styles.receiptMeta}>Issued {issuedAt}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.receiptId}>{receiptNumber}</Text>
            <View style={styles.paidPill}>
              <Text style={styles.paidText}>Paid in full</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.colHeader}>Bill to</Text>
            <Text style={styles.colBody}>{customer.name}</Text>
            <Text style={styles.colMuted}>{customer.email}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.colHeader}>Ship to</Text>
            <Text style={styles.colBody}>{customer.name}</Text>
            {shipFull ? <Text style={styles.colMuted}>{shipFull}</Text> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.colHeader}>Item</Text>
        <View style={[styles.itemRow, { marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>
              {watch.brand} {watch.model}
            </Text>
            {(watch.referenceNumber || watch.year || watch.condition) ? (
              <Text style={styles.itemMeta}>
                {[
                  watch.referenceNumber ? `Ref. ${watch.referenceNumber}` : null,
                  watch.year || null,
                  watch.condition || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            {(watch.hasBox || watch.hasPapers) ? (
              <Text style={styles.itemMeta}>
                {[watch.hasBox ? "Box" : null, watch.hasPapers ? "Papers" : null]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            ) : null}
          </View>
          <Text style={styles.amount}>{formatUSD(totals.subtotalCents)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{formatUSD(totals.subtotalCents)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Shipping (insured)</Text>
          <Text style={styles.totalsValue}>{formatUSD(totals.shippingCents)}</Text>
        </View>
        {totals.taxCents > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{formatUSD(totals.taxCents)}</Text>
          </View>
        ) : null}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalValue}>{formatUSD(totals.totalCents)}</Text>
        </View>

        <Text style={styles.paidLine}>
          Paid via {payment.method} on {payment.date}
          {payment.confirmation ? `   ·   Confirmation: ${payment.confirmation}` : ""}
        </Text>

        <View style={styles.divider} />

        <Text style={styles.thankYou}>
          Thank you for your purchase. Your watch will ship insured within 2 business days.
          Tracking will follow.
        </Text>
        <Text style={styles.signature}>— {soldBy || "Studio Chrono"}</Text>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <Text>{business.website}</Text>
          <Text>·</Text>
          <Text>{business.location}</Text>
        </View>
      </Page>
    </Document>
  );
}
