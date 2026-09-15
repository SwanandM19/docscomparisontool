import { z } from "zod";
import type { Part } from "@google/generative-ai";
import { generateJson } from "@/lib/ai/gemini";
import { buildFilePart } from "@/lib/ai/file-parts";
import { ApiError } from "@/lib/api-utils/errors";
import type { DocumentSummary, SummarySourceFile } from "@/types/summary";

const labelledValueSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const documentSummarySchema = z.object({
  documentType: z.string().min(1),
  title: z.string().min(1),
  overview: z.string().min(1),
  parties: z
    .array(z.object({ role: z.string(), name: z.string(), details: z.string() }))
    .default([]),
  keyFields: z.array(labelledValueSchema).default([]),
  dates: z.array(labelledValueSchema).default([]),
  financials: z.array(labelledValueSchema).default([]),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.string(),
        unitPrice: z.string(),
        amount: z.string(),
      })
    )
    .default([]),
  highlights: z.array(z.string()).default([]),
});

const responseSchema = z.object({
  documents: z.array(documentSummarySchema).min(1),
});

const SYSTEM_INSTRUCTION = `You are a meticulous business analyst. For EACH document you are given, produce a
detailed, well-organised summary that lets a reader who has never seen the document understand it
fully. The documents can be of ANY type — purchase orders, tax invoices, goods receipt notes,
contracts, agreements, quotations, delivery challans, bank statements, letters, reports, résumés,
forms, and so on.

Rules:
- Ground every statement strictly in the document. Never invent parties, numbers, dates, clauses or
  totals. If something important for that document type is absent, record it as a highlight
  (e.g. "No invoice number is printed on the document").
- "documentType" is your best specific classification (e.g. "Tax Invoice", "Purchase Order",
  "Employment Contract", "Bank Statement", "Technical Reference Document").
- "overview" must be thorough, not a teaser: write as many full sentences as it takes to cover what
  the document actually contains — typically 8 to 15+ sentences for anything with real substance,
  more for a long or dense document. Walk through its structure in order (each major section,
  clause, chapter, or topic it covers), not just a one-line theme. Name the parties, every figure
  that matters, and the document's purpose. A short document may earn a short overview, but never
  compress a substantial document into a handful of sentences — the reader must be able to skip the
  original and still know everything in it.
- "keyFields" holds every identifying / reference field that matters for this document type —
  document numbers, PO/invoice/GRN numbers, GSTIN / PAN / tax ids, payment terms, order
  references, place of supply, delivery terms, contract term/duration, parties' registration ids,
  etc. Use clear labels. For a non-business/technical document, use this for whatever it has instead
  — section/chapter numbers, version numbers, standards or specs referenced, formulas or named
  algorithms/models, citations, authors, etc.
- "dates" holds every date on the document (issue date, due date, delivery date, period covered,
  signature date, publication date …) with a descriptive label.
- "financials" holds every monetary figure — subtotal, each tax component (CGST/SGST/IGST/VAT),
  discounts, freight, round-off, grand total, amount in words, balance due. Keep the currency
  symbol/code exactly as printed.
- "lineItems" holds the itemised rows if the document has a table of goods/services, or any other
  tabular/enumerated data (e.g. a list of algorithms, specs, clauses, chapters) — reuse its four
  columns loosely (description/quantity/unitPrice/amount) to carry whatever that document's rows
  actually are; leave a cell "" if it doesn't apply.
- "highlights" must be a substantive list (aim for at least 6-10 for any document with real content,
  not just 2-3) that together summarise every distinct topic, section, clause, or noteworthy point in
  the document — one document with seven sections should produce highlights covering all seven, not
  a single generic remark about there being seven. Also call out anything notable: unusually large
  totals, missing mandatory fields, hand-written amendments, penalty/interest clauses, mismatches,
  expiry, or other risks.
- Depth over brevity throughout: when in doubt, include more detail rather than less. This summary
  is meant to replace reading the original document, not to tease it.
- Return ONLY a single JSON object matching the schema — no markdown, no commentary.`;

/** Builds the per-request prompt listing every file to summarise. */
function buildPrompt(files: SummarySourceFile[]): string {
  const list = files.map((f, i) => `  ${i + 1}. "${f.fileName}"`).join("\n");
  return `Summarise the ${files.length} attached document(s), in the same order they are attached:
${list}

Return a JSON object with EXACTLY this shape:
{
  "documents": [
    {
      "documentType": string,
      "title": string,
      "overview": string,
      "parties": [{ "role": string, "name": string, "details": string }],
      "keyFields": [{ "label": string, "value": string }],
      "dates": [{ "label": string, "value": string }],
      "financials": [{ "label": string, "value": string }],
      "lineItems": [{ "description": string, "quantity": string, "unitPrice": string, "amount": string }],
      "highlights": [string]
    }
  ]
}

The "documents" array MUST have exactly ${files.length} entry(ies), one per attached file, in order.`;
}

/**
 * Sends every uploaded file to Gemini in one request and returns a detailed
 * structured summary for each, in the same order.
 */
export async function summarizeFiles(files: SummarySourceFile[]): Promise<DocumentSummary[]> {
  const fileParts = await Promise.all(files.map((f) => buildFilePart(f)));

  const promptParts: (string | Part)[] = [buildPrompt(files), ...fileParts];

  let parsed;
  try {
    const raw = await generateJson<unknown>(promptParts, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      timeoutMs: 90_000,
    });
    parsed = responseSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.upstream(
        "The AI summary response did not match the expected format.",
        err.flatten()
      );
    }
    throw err;
  }

  // Pair each returned summary with its source file name by position; if the
  // model returned a different count, fall back gracefully.
  return parsed.documents.map((doc, i) => ({
    fileName: files[i]?.fileName ?? `Document ${i + 1}`,
    ...doc,
  }));
}
