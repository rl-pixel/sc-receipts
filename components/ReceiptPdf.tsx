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

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAPER.bg,
    color: PAPER.ink,
    paddingHorizontal: 43,
    paddingVertical: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.45,
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
    marginVertical: 18,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  receiptHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    letterSpacing: -0.4,
  },
  receiptMeta: {
    fontSize: 9,
    color: PAPER.muted,
    marginTop: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  paidText: {
    color: PAPER.successText,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
  },
  twoCol: {
    flexDirection: "row",
    gap: 36,
  },
  colHeader: {
    fontSize: 8,
    color: PAPER.muted,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  colBody: {
    fontSize: 10,
    color: PAPER.ink,
  },
  colMuted: {
    fontSize: 10,
    color: PAPER.muted,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
  },
  itemMeta: {
    fontSize: 9.5,
    color: PAPER.muted,
    marginTop: 3,
  },
  amount: {
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
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
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: PAPER.divider,
    marginTop: 6,
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
  },
  paidLine: {
    fontSize: 9.5,
    color: PAPER.muted,
    marginTop: 8,
  },
  thankYou: {
    fontSize: 10,
    color: PAPER.ink,
    lineHeight: 1.55,
  },
  signature: {
    fontSize: 10,
    color: PAPER.ink,
    marginTop: 6,
  },
  footer: {
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
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
  const { customer, watch, payment, totals, receiptNumber, issuedAt, business } = data;
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
      <Page size="LETTER" style={styles.page}>
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
              <Text style={styles.paidText}>PAID IN FULL ✓</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.colHeader}>Bill To</Text>
            <Text style={styles.colBody}>{customer.name}</Text>
            <Text style={styles.colMuted}>{customer.email}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.colHeader}>Ship To</Text>
            <Text style={styles.colBody}>{customer.name}</Text>
            {shipFull ? <Text style={styles.colMuted}>{shipFull}</Text> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.colHeader}>Item</Text>
        <View style={[styles.itemRow, { marginTop: 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>
              {watch.brand} {watch.model}
            </Text>
            {watch.referenceNumber ? (
              <Text style={styles.itemMeta}>
                Ref. {watch.referenceNumber}
                {watch.year ? ` · ${watch.year}` : ""}
                {watch.condition ? ` · ${watch.condition}` : ""}
              </Text>
            ) : (
              <Text style={styles.itemMeta}>
                {watch.year ? `${watch.year} · ` : ""}
                {watch.condition}
              </Text>
            )}
            {(watch.hasBox || watch.hasPapers) ? (
              <Text style={styles.itemMeta}>
                {watch.hasBox ? "Box" : ""}
                {watch.hasBox && watch.hasPapers ? "  ·  " : ""}
                {watch.hasPapers ? "Papers" : ""}
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
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>{formatUSD(totals.taxCents)}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL PAID</Text>
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
        <Text style={styles.signature}>— Joe, Studio Chrono</Text>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <Text>{business.footer}</Text>
          <Text>{business.website} · {business.location}</Text>
        </View>
      </Page>
    </Document>
  );
}
