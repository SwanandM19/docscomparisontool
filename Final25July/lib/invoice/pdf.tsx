import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { calculateInvoice, lineAmount } from "@/lib/invoice/calculate";
import type { InvoiceData, InvoiceParty } from "@/types/invoice";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1e1b2e" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 24, fontWeight: 700, letterSpacing: 1 },
  sellerName: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  meta: { fontSize: 9, color: "#64748b", marginBottom: 2, textAlign: "right" },
  metaValue: { fontSize: 10, fontWeight: 700, color: "#1e1b2e" },

  rule: { borderBottomWidth: 1.5, borderBottomColor: "#1e1b2e", marginVertical: 14 },

  partyRow: { flexDirection: "row", justifyContent: "space-between", gap: 24 },
  partyBlock: { width: "48%" },
  partyLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
    marginBottom: 4,
  },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 9, color: "#475569", marginBottom: 1.5 },

  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 18, marginBottom: 6 },

  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  headerCell: { fontWeight: 700, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  cellText: { fontSize: 9 },

  colNo: { width: "6%" },
  colDesc: { width: "36%" },
  colHsn: { width: "12%" },
  colQty: { width: "10%", textAlign: "right" },
  colRate: { width: "14%", textAlign: "right" },
  colTax: { width: "8%", textAlign: "right" },
  colAmt: { width: "14%", textAlign: "right" },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalsBox: { width: "52%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: "#64748b" },
  totalValue: { fontSize: 9, fontWeight: 700 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    marginTop: 5,
    borderTopWidth: 1.5,
    borderTopColor: "#1e1b2e",
  },
  grandLabel: { fontSize: 11, fontWeight: 700 },
  grandValue: { fontSize: 13, fontWeight: 700 },

  noteBlock: { marginTop: 18 },
  noteLabel: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
    marginBottom: 3,
  },
  noteText: { fontSize: 9, color: "#475569", lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

/**
 * Formats money for the PDF. Deliberately avoids the `₹` glyph, which the
 * built-in Helvetica font can't render (it would print as a blank box) —
 * INR is written as `Rs.` instead, matching lib/export/pdf.tsx.
 */
function pdfAmount(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  if (currency === "INR") return `Rs. ${formatted}`;
  if (currency === "USD") return `$ ${formatted}`;
  return `${currency} ${formatted}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PartyBlock({ label, party }: { label: string; party: InvoiceParty }) {
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyLabel}>{label}</Text>
      <Text style={styles.partyName}>{party.name || "—"}</Text>
      {party.address
        ? party.address
            .split("\n")
            .filter(Boolean)
            .map((line, i) => (
              <Text key={i} style={styles.partyLine}>
                {line}
              </Text>
            ))
        : null}
      {party.gstin ? <Text style={styles.partyLine}>GSTIN: {party.gstin}</Text> : null}
      {party.email ? <Text style={styles.partyLine}>{party.email}</Text> : null}
      {party.phone ? <Text style={styles.partyLine}>{party.phone}</Text> : null}
    </View>
  );
}

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const totals = calculateInvoice(data);
  const currency = data.currency || "INR";

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author={data.seller.name || "DocIntel"}
      subject={`Invoice ${data.invoiceNumber}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ width: "55%" }}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={[styles.sellerName, { marginTop: 10 }]}>{data.seller.name || "—"}</Text>
            {data.seller.gstin ? (
              <Text style={styles.partyLine}>GSTIN: {data.seller.gstin}</Text>
            ) : null}
          </View>
          <View style={{ width: "40%" }}>
            <Text style={styles.meta}>Invoice No.</Text>
            <Text style={[styles.meta, styles.metaValue]}>{data.invoiceNumber || "—"}</Text>
            <Text style={[styles.meta, { marginTop: 6 }]}>Invoice Date</Text>
            <Text style={[styles.meta, styles.metaValue]}>{formatDate(data.invoiceDate)}</Text>
            {data.dueDate ? (
              <>
                <Text style={[styles.meta, { marginTop: 6 }]}>Due Date</Text>
                <Text style={[styles.meta, styles.metaValue]}>{formatDate(data.dueDate)}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.rule} />

        {/* Parties */}
        <View style={styles.partyRow}>
          <PartyBlock label="From" party={data.seller} />
          <PartyBlock label="Bill To" party={data.buyer} />
        </View>

        {/* Line items */}
        <Text style={styles.sectionTitle}>Items</Text>
        <View>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colNo, styles.headerCell]}>#</Text>
            <Text style={[styles.colDesc, styles.headerCell]}>Description</Text>
            <Text style={[styles.colHsn, styles.headerCell]}>HSN/SAC</Text>
            <Text style={[styles.colQty, styles.headerCell]}>Qty</Text>
            <Text style={[styles.colRate, styles.headerCell]}>Rate</Text>
            <Text style={[styles.colTax, styles.headerCell]}>Tax</Text>
            <Text style={[styles.colAmt, styles.headerCell]}>Amount</Text>
          </View>
          {data.lineItems.map((item, i) => (
            <View style={styles.tableRow} key={item.id || i} wrap={false}>
              <Text style={[styles.colNo, styles.cellText]}>{i + 1}</Text>
              <Text style={[styles.colDesc, styles.cellText]}>{item.description || "—"}</Text>
              <Text style={[styles.colHsn, styles.cellText]}>{item.hsn || "—"}</Text>
              <Text style={[styles.colQty, styles.cellText]}>{item.quantity}</Text>
              <Text style={[styles.colRate, styles.cellText]}>
                {pdfAmount(item.unitPrice, currency)}
              </Text>
              <Text style={[styles.colTax, styles.cellText]}>
                {data.taxMode === "none" ? "—" : `${item.taxRate}%`}
              </Text>
              <Text style={[styles.colAmt, styles.cellText]}>
                {pdfAmount(lineAmount(item), currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{pdfAmount(totals.subtotal, currency)}</Text>
            </View>
            {totals.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={styles.totalValue}>− {pdfAmount(totals.discount, currency)}</Text>
              </View>
            )}
            {totals.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Taxable Value</Text>
                <Text style={styles.totalValue}>{pdfAmount(totals.taxableValue, currency)}</Text>
              </View>
            )}
            {totals.taxLines.map((line, i) => (
              <View style={styles.totalRow} key={i}>
                <Text style={styles.totalLabel}>{line.label}</Text>
                <Text style={styles.totalValue}>{pdfAmount(line.amount, currency)}</Text>
              </View>
            ))}
            {totals.shipping > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Shipping / Other</Text>
                <Text style={styles.totalValue}>{pdfAmount(totals.shipping, currency)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Total Due</Text>
              <Text style={styles.grandValue}>{pdfAmount(totals.grandTotal, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Notes & terms */}
        {data.notes ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Notes</Text>
            <Text style={styles.noteText}>{data.notes}</Text>
          </View>
        ) : null}
        {data.terms ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Terms & Conditions</Text>
            <Text style={styles.noteText}>{data.terms}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {data.seller.name ? `${data.seller.name} · ` : ""}Invoice {data.invoiceNumber} · Generated
          with DocIntel
        </Text>
      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
