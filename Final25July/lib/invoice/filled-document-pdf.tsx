import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerDevanagariFonts, PDF_FONT_FAMILY } from "@/lib/pdf/fonts";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1e1b2e", lineHeight: 1.5 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#64748b", marginBottom: 14 },
  rule: { borderBottomWidth: 1.5, borderBottomColor: "#1e1b2e", marginBottom: 14 },
  para: { fontSize: 10, marginBottom: 4 },
  spacer: { height: 6 },
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

export interface FilledDocumentPdfInput {
  documentType: string;
  content: string;
}

/** Renders the completed document's text, preserving its line breaks. */
function TextBlock({ text }: { text: string }) {
  const lines = (text || "—").replace(/\r\n/g, "\n").split("\n");
  return (
    <View>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <View key={i} style={styles.spacer} />
        ) : (
          <Text key={i} style={styles.para}>
            {line}
          </Text>
        )
      )}
    </View>
  );
}

function FilledDocument({ documentType, content }: FilledDocumentPdfInput) {
  return (
    <Document title={documentType} subject="Filled document">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{documentType}</Text>
        <Text style={styles.subtitle}>Completed with DocIntel&apos;s Document Filler</Text>
        <View style={styles.rule} />
        <TextBlock text={content} />
        <Text style={styles.footer} fixed>
          {documentType} · Generated with DocIntel
        </Text>
      </Page>
    </Document>
  );
}

export async function generateFilledDocumentPdf(input: FilledDocumentPdfInput): Promise<Buffer> {
  registerDevanagariFonts();
  return renderToBuffer(<FilledDocument {...input} />);
}
