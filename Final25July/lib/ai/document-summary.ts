import { generateText } from "@/lib/ai/gemini";
import type { DocumentDoc } from "@/lib/models/Document";
import type { ExtractedDocumentData } from "@/types/document";

const SYSTEM_INSTRUCTION = `You are a procurement analyst writing a short, plain-language summary of a
single business document (a Purchase Order, Goods Receipt Note, Invoice, or Contract) for a reader
who has not seen it. Ground every statement strictly in the structured data you are given — never
invent parties, numbers, or dates that are not present.

Output rules (plain text, not markdown):
- 2 to 4 sentences, 50-110 words total. No headings, no bullet lists, no preamble like "This document".
- Open by stating what kind of document it is and who the vendor / parties are (if known).
- Mention the most important figures: total amount in Indian Rupees using the ₹ symbol
  (e.g. ₹32,460.00) — never dollars or $ — the document date, and how many line items it contains.
- Note anything that stands out (large total, missing GSTIN or document number, unusual tax
  breakdown) only if the data actually shows it.
- If a field is null/empty, simply omit it — only call an absence "missing" when it genuinely
  matters for this kind of document (e.g. an Invoice with no invoice number).`;

function buildPrompt(doc: DocumentDoc, data: ExtractedDocumentData): string {
  return `Summarize this ${doc.kind} document. Structured extraction (JSON):

${JSON.stringify(
  {
    kind: doc.kind,
    fileName: doc.fileName,
    documentType: data.documentType,
    vendorName: data.vendorName,
    vendorGSTIN: data.vendorGSTIN,
    poNumber: data.poNumber,
    invoiceNumber: data.invoiceNumber,
    grnNumber: data.grnNumber,
    documentDate: data.documentDate,
    currency: data.currency,
    totalAmount: data.totalAmount,
    taxDetails: data.taxDetails,
    lineItemCount: data.lineItems.length,
    lineItems: data.lineItems.slice(0, 40),
  },
  null,
  2
)}

Write the summary per your instructions.`;
}

/**
 * Generates a standalone plain-language summary of a single extracted
 * document, independent of any comparison. Requires completed extraction.
 */
export async function generateDocumentSummary(doc: DocumentDoc): Promise<string> {
  if (!doc.extractedData) {
    throw new Error("Document has no extracted data to summarize.");
  }

  return generateText([buildPrompt(doc, doc.extractedData)], {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.3,
    timeoutMs: 25_000,
  });
}
