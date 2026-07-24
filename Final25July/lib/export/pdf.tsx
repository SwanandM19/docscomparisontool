import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ComparisonDoc } from "@/lib/models/Comparison";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1e1b2e" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#64748b", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#64748b" },
  value: { fontWeight: 700 },
  badge: { padding: 4, borderRadius: 4, fontSize: 10, fontWeight: 700 },
  table: { display: "flex", width: "auto", marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 5 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#1e1b2e", paddingVertical: 5 },
  cellDesc: { width: "34%" },
  cellSm: { width: "11%" },
  cellFlag: { width: "23%" },
  headerCell: { fontWeight: 700, fontSize: 9, textTransform: "uppercase" },
  cellText: { fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

function statusColor(status: string) {
  if (status === "Matched") return "#059669";
  if (status === "Partial") return "#d97706";
  return "#dc2626";
}

function ComparisonReportDocument({ comparison }: { comparison: ComparisonDoc }) {
  const createdAt = new Date(comparison.createdAt).toLocaleString();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>DocIntel — Comparison Report</Text>
        <Text style={styles.subtitle}>
          {comparison.mode.toUpperCase()} match · Generated {createdAt}
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Match Status</Text>
          <Text style={[styles.value, { color: statusColor(comparison.score.status) }]}>
            {comparison.score.status}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Overall Match Score</Text>
          <Text style={styles.value}>{comparison.score.matchScore}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Line Item Accuracy</Text>
          <Text style={styles.value}>{comparison.score.lineItemAccuracy}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Extraction Confidence</Text>
          <Text style={styles.value}>{comparison.score.confidenceScore}%</Text>
        </View>

        <Text style={styles.sectionTitle}>Financial Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Expected (PO)</Text>
          <Text style={styles.value}>Rs. {comparison.financials.totalExpected.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Invoiced</Text>
          <Text style={styles.value}>Rs. {comparison.financials.totalInvoiced.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Net Variance</Text>
          <Text style={[styles.value, { color: comparison.financials.netVariance > 0 ? "#dc2626" : "#059669" }]}>
            Rs. {comparison.financials.netVariance.toFixed(2)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Potential Savings Identified</Text>
          <Text style={styles.value}>Rs. {comparison.financials.potentialSavings.toFixed(2)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Line Item Comparison</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.cellDesc, styles.headerCell]}>Description</Text>
            <Text style={[styles.cellSm, styles.headerCell]}>PO Qty</Text>
            <Text style={[styles.cellSm, styles.headerCell]}>Inv Qty</Text>
            <Text style={[styles.cellSm, styles.headerCell]}>PO Price</Text>
            <Text style={[styles.cellSm, styles.headerCell]}>Inv Price</Text>
            <Text style={[styles.cellFlag, styles.headerCell]}>Flag</Text>
          </View>
          {comparison.lineItemDiffs.map((item) => (
            <View style={styles.tableRow} key={item.id}>
              <Text style={[styles.cellDesc, styles.cellText]}>{item.description}</Text>
              <Text style={[styles.cellSm, styles.cellText]}>{item.poQty ?? "—"}</Text>
              <Text style={[styles.cellSm, styles.cellText]}>{item.invQty ?? "—"}</Text>
              <Text style={[styles.cellSm, styles.cellText]}>{item.poPrice != null ? `$${item.poPrice.toFixed(2)}` : "—"}</Text>
              <Text style={[styles.cellSm, styles.cellText]}>{item.invPrice != null ? `$${item.invPrice.toFixed(2)}` : "—"}</Text>
              <Text style={[styles.cellFlag, styles.cellText]}>
                {[item.qtyVarianceTag, item.priceVarianceTag].filter(Boolean).join(" ") || "OK"}
              </Text>
            </View>
          ))}
        </View>

        {comparison.aiSummary && (
          <>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <Text style={styles.cellText}>{comparison.aiSummary}</Text>
          </>
        )}

        {comparison.aiRecommendation && (
          <>
            <Text style={styles.sectionTitle}>Recommendation</Text>
            <Text style={[styles.value, { color: statusColor(comparison.score.status), marginBottom: 4 }]}>
              {comparison.aiRecommendation.decision}
            </Text>
            <Text style={styles.cellText}>{comparison.aiRecommendation.reason}</Text>
          </>
        )}

        <Text style={styles.footer}>
          DocIntel Workspace · Confidential audit document · Comparison ID: {comparison._id.toString()}
        </Text>
      </Page>
    </Document>
  );
}

export async function generateComparisonPdf(comparison: ComparisonDoc): Promise<Buffer> {
  return renderToBuffer(<ComparisonReportDocument comparison={comparison} />);
}
