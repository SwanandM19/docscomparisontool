import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY, pdfFontFamilyForLanguage } from "@/lib/pdf/fonts";
import { directionSource, directionTarget, type TranslationDirection } from "@/types/translation";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: PDF_FONT_FAMILY, color: "#1e1b2e", lineHeight: 1.5 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#64748b", marginBottom: 2 },
  rule: { borderBottomWidth: 1.5, borderBottomColor: "#1e1b2e", marginVertical: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#4c1d95",
  },
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

export interface TranslationPdfInput {
  fileName: string;
  directionLabel: string;
  sourceLabel: string;
  targetLabel: string;
  sourceText: string;
  translatedText: string;
  confidence: number;
  direction: TranslationDirection;
}

/** Renders one block of text, preserving its line breaks, in the given font family. */
function TextBlock({ text, fontFamily }: { text: string; fontFamily: string }) {
  const lines = (text || "—").replace(/\r\n/g, "\n").split("\n");
  return (
    <View>
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <View key={i} style={styles.spacer} />
        ) : (
          <Text key={i} style={[styles.para, { fontFamily }]}>
            {line}
          </Text>
        )
      )}
    </View>
  );
}

function TranslationDocument(input: TranslationPdfInput) {
  // Source and target can be different scripts (e.g. English -> Tamil), so
  // each text block picks its own font family rather than sharing one.
  const sourceFontFamily = pdfFontFamilyForLanguage(directionSource(input.direction));
  const targetFontFamily = pdfFontFamilyForLanguage(directionTarget(input.direction));

  return (
    <Document title={`${input.fileName} — ${input.directionLabel}`} subject="Translation">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{input.fileName}</Text>
        <Text style={styles.subtitle}>{input.directionLabel}</Text>
        <Text style={styles.subtitle}>
          Word-for-word translation · confidence {Math.round(input.confidence * 100)}%
        </Text>

        <View style={styles.rule} />

        <Text style={styles.sectionTitle}>Original — {input.sourceLabel}</Text>
        <TextBlock text={input.sourceText} fontFamily={sourceFontFamily} />

        <Text style={styles.sectionTitle}>Translation — {input.targetLabel}</Text>
        <TextBlock text={input.translatedText} fontFamily={targetFontFamily} />

        <Text style={styles.footer} fixed>
          {input.fileName} · {input.directionLabel} · Generated with DocIntel
        </Text>
      </Page>
    </Document>
  );
}

export async function generateTranslationPdf(input: TranslationPdfInput): Promise<Buffer> {
  return renderToBuffer(<TranslationDocument {...input} />);
}
