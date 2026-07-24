import mammoth from "mammoth";
import { z } from "zod";
import { generateJson, fileUrlToInlinePart } from "@/lib/ai/gemini";
import { ApiError } from "@/lib/api-utils/errors";
import type { DocumentFileType, DocumentKind, ExtractedDocumentData } from "@/types/document";

const extractedLineItemSchema = z.object({
  itemNo: z.string().nullable().optional(),
  description: z.string(),
  // Non-procurement documents (Universal/Contract presets) often don't have
  // per-item quantity/pricing — Gemini legitimately returns null for these
  // rather than a number, so they're coerced to 0 rather than rejected.
  quantity: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
});

const taxDetailSchema = z.object({
  taxType: z.string(),
  rate: z.number(),
  amount: z.number(),
});

/**
 * Validates the shape of whatever Gemini returns before it's allowed to
 * touch the database — checklist item "Validate extracted JSON".
 */
const extractionResponseSchema = z.object({
  // Nullable because Gemini can't always confidently classify a generic
  // Universal/Contract-preset document into one of these four kinds — falls
  // back to the expected kind (see extractDocumentData) rather than failing.
  documentType: z.enum(["PO", "GRN", "Invoice", "Contract"]).nullable(),
  vendorName: z.string().nullable(),
  vendorGSTIN: z.string().nullable(),
  poNumber: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  grnNumber: z.string().nullable(),
  documentDate: z.string().nullable(),
  currency: z.string().nullable(),
  totalAmount: z.number().nullable(),
  taxDetails: z.array(taxDetailSchema).default([]),
  lineItems: z.array(extractedLineItemSchema).default([]),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_INSTRUCTION = `You are a precise document-data-extraction engine for an enterprise
procurement audit platform. You will be given a business document (a Purchase Order, Goods
Receipt Note, Invoice, or Contract) as an image or PDF. Extract ONLY the fields that are
explicitly present in the document — never invent, guess, or hallucinate values. If a field is
not present or not legible, return null for it (or an empty array for list fields). Numbers must
be plain numbers (no currency symbols or thousands separators). Dates must be normalized to
ISO 8601 (YYYY-MM-DD) where possible. Respond with ONLY a single JSON object matching the
exact schema you are given — no markdown, no commentary, no code fences.`;

function buildExtractionPrompt(expectedKind: DocumentKind): string {
  return `Extract structured data from the attached ${expectedKind} document.

Return a JSON object with EXACTLY this shape:
{
  "documentType": "PO" | "GRN" | "Invoice" | "Contract",
  "vendorName": string | null,
  "vendorGSTIN": string | null,
  "poNumber": string | null,
  "invoiceNumber": string | null,
  "grnNumber": string | null,
  "documentDate": string | null,
  "currency": string | null,
  "totalAmount": number | null,
  "taxDetails": [{ "taxType": string, "rate": number, "amount": number }],
  "lineItems": [{ "itemNo": string | null, "description": string, "quantity": number, "unitPrice": number, "total": number }],
  "confidence": number
}

Rules:
- "documentType" should reflect what the document actually appears to be, which is expected to be "${expectedKind}" but may differ — extract what you observe.
- "confidence" is your own 0.0–1.0 estimate of how confident you are in the overall extraction given legibility/completeness.
- Every line item's "total" should equal quantity × unitPrice when both are present; if the printed total differs, use the document's printed total.
- Do not fabricate a GRN/PO/Invoice number if none is printed on the document — use null.`;
}

function mimeTypeForFileType(fileType: DocumentFileType, mimeType: string): string {
  if (fileType === "excel") {
    // Gemini cannot natively read binary spreadsheets as inline data the way
    // it reads PDFs/images. We still pass the mime type through; callers that
    // need robust Excel parsing should pre-convert to CSV/text upstream. For
    // MVP we rely on Gemini's best-effort handling of the raw bytes as text
    // if it's a CSV, or fall back to signalling low confidence otherwise.
    return mimeType === "text/csv" ? "text/csv" : mimeType;
  }
  return mimeType;
}

/**
 * Gemini's inline-data API doesn't reliably parse raw .docx/.doc binaries, so
 * Word documents are extracted to plain text locally (via mammoth) and sent
 * as a text prompt part instead of an inline file part.
 */
async function extractWordDocumentText(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw ApiError.upstream(`Failed to fetch file for extraction: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
  return text;
}

/**
 * Runs AI extraction on a stored document's file, validates the response,
 * and returns a normalized ExtractedDocumentData object ready to persist.
 */
export async function extractDocumentData(params: {
  fileUrl: string;
  mimeType: string;
  fileType: DocumentFileType;
  expectedKind: DocumentKind;
}): Promise<{ data: ExtractedDocumentData; confidence: number }> {
  const { fileUrl, mimeType, fileType, expectedKind } = params;

  const prompt = buildExtractionPrompt(expectedKind);
  const documentPart =
    fileType === "word"
      ? `Document text (extracted from a Word file):\n\n${await extractWordDocumentText(fileUrl)}`
      : await fileUrlToInlinePart(fileUrl, mimeTypeForFileType(fileType, mimeType));

  let parsed;
  try {
    const raw = await generateJson<unknown>([prompt, documentPart], {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      timeoutMs: 45_000,
    });
    parsed = extractionResponseSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.validation("AI extraction response failed schema validation.", err.flatten());
    }
    throw err;
  }

  const { confidence, ...rest } = parsed;

  const data: ExtractedDocumentData = {
    documentType: rest.documentType ?? expectedKind,
    vendorName: rest.vendorName,
    vendorGSTIN: rest.vendorGSTIN,
    poNumber: rest.poNumber,
    invoiceNumber: rest.invoiceNumber,
    grnNumber: rest.grnNumber,
    documentDate: rest.documentDate,
    currency: rest.currency,
    totalAmount: rest.totalAmount,
    taxDetails: rest.taxDetails,
    lineItems: rest.lineItems.map((li) => ({
      itemNo: li.itemNo ?? undefined,
      description: li.description,
      quantity: li.quantity ?? 0,
      unitPrice: li.unitPrice ?? 0,
      total: li.total ?? 0,
    })),
  };

  return { data, confidence: Math.round(confidence * 100) };
}
