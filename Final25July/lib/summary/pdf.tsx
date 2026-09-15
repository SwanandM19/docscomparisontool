import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerDevanagariFonts, PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import type { DocumentSummary, LabelledValue } from "@/types/summary";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1e1b2e", lineHeight: 1.45 },
  docTitle: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  docMeta: { fontSize: 9, color: "#64748b", marginBottom: 10 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#cbd5e1", marginVertical: 10 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#4c1d95",
  },
  para: { fontSize: 10, marginBottom: 6 },
  kvRow: { flexDirection: "row", marginBottom: 2 },
  kvLabel: { width: "38%", fontSize: 9, color: "#64748b" },
  kvValue: { width: "62%", fontSize: 9, fontWeight: 700 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9 },
  tHead: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 4, paddingHorizontal: 3 },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  tDesc: { width: "46%", fontSize: 8 },
  tQty: { width: "18%", fontSize: 8, textAlign: "right" },
  tUnit: { width: "18%", fontSize: 8, textAlign: "right" },
  tAmt: { width: "18%", fontSize: 8, textAlign: "right", fontWeight: 700 },
  tHeadCell: { fontWeight: 700, fontSize: 8, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

function KeyValues({ items }: { items: LabelledValue[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={styles.kvRow}>
          <Text style={styles.kvLabel}>{it.label}</Text>
          <Text style={styles.kvValue}>{it.value || "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function DocSection({ doc, index }: { doc: DocumentSummary; index: number }) {
  return (
    <View break={index > 0}>
      <Text style={styles.docTitle}>{doc.title}</Text>
      <Text style={styles.docMeta}>
        {doc.documentType} · {doc.fileName}
      </Text>

      <Text style={styles.sectionTitle}>Overview</Text>
      <Text style={styles.para}>{doc.overview}</Text>

      {doc.parties.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Parties</Text>
          {doc.parties.map((p, i) => (
            <View key={i} style={styles.kvRow}>
              <Text style={styles.kvLabel}>{p.role}</Text>
              <Text style={styles.kvValue}>
                {p.name}
                {p.details ? ` — ${p.details}` : ""}
              </Text>
            </View>
          ))}
        </>
      )}

      {doc.keyFields.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Key details</Text>
          <KeyValues items={doc.keyFields} />
        </>
      )}

      {doc.dates.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Dates</Text>
          <KeyValues items={doc.dates} />
        </>
      )}

      {doc.financials.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Financials</Text>
          <KeyValues items={doc.financials} />
        </>
      )}

      {doc.lineItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Line items</Text>
          <View style={styles.tHead}>
            <Text style={[styles.tDesc, styles.tHeadCell]}>Description</Text>
            <Text style={[styles.tQty, styles.tHeadCell]}>Qty</Text>
            <Text style={[styles.tUnit, styles.tHeadCell]}>Unit</Text>
            <Text style={[styles.tAmt, styles.tHeadCell]}>Amount</Text>
          </View>
          {doc.lineItems.map((li, i) => (
            <View key={i} style={styles.tRow} wrap={false}>
              <Text style={styles.tDesc}>{li.description || "—"}</Text>
              <Text style={styles.tQty}>{li.quantity}</Text>
              <Text style={styles.tUnit}>{li.unitPrice}</Text>
              <Text style={styles.tAmt}>{li.amount}</Text>
            </View>
          ))}
        </>
      )}

      {doc.highlights.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <Bullets items={doc.highlights} />
        </>
      )}
    </View>
  );
}

function SummaryDocument({ documents }: { documents: DocumentSummary[] }) {
  return (
    <Document title="Document Summary" subject="Document Summary">
      <Page size="A4" style={styles.page} wrap>
        {documents.map((doc, i) => (
          <DocSection key={i} doc={doc} index={i} />
        ))}
        <Text style={styles.footer} fixed>
          Document Summary · Generated with DocIntel
        </Text>
      </Page>
    </Document>
  );
}

export async function generateSummaryPdf(documents: DocumentSummary[]): Promise<Buffer> {
  registerDevanagariFonts();
  return renderToBuffer(<SummaryDocument documents={documents} />);
}
