import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { buildFilePart, type PromptFile } from "@/lib/ai/file-parts";
import { ApiError } from "@/lib/api-utils/errors";
import type { DocumentFieldsResult } from "@/types/invoice-fill";

const responseSchema = z.object({
  documentType: z.string().min(1),
  detectedLayout: z.string().min(1),
  fields: z
    .array(
      z.object({
        label: z.string(),
        originalValue: z.string().default(""),
        isBlank: z.boolean().default(true),
      })
    )
    .default([]),
});

const SYSTEM_INSTRUCTION = `You are a document-layout analysis assistant. The user gives you ONE
document — their own invoice, bill, or form. Your job is ONLY to read its layout and list every
fillable field on it — do not fill anything in yourself.

1. Read the document and identify its title, every labelled field, every table column, and every
   place where a value is expected.
2. For each field, report the label as it appears on the document, whatever value is already
   printed there ("originalValue" — empty string if none), and whether it is currently blank
   ("isBlank").
3. For table line items, use labels like "Line 1 — Description", "Line 1 — Qty", etc., one field
   per column per row that has (or should have) a value.
4. List fields in the order they appear on the document.

Return ONLY a single JSON object matching the schema — no markdown, no commentary.`;

function buildPrompt(file: PromptFile): string {
  return `Uploaded document: "${file.fileName}"

Return a JSON object with EXACTLY this shape:
{
  "documentType": string,
  "detectedLayout": string,
  "fields": [
    { "label": string, "originalValue": string, "isBlank": boolean }
  ]
}`;
}

/**
 * Reads an uploaded document's layout and returns every fillable field it
 * finds, flagging which are currently blank — the detect half of the
 * Document Filler's detect-then-fill flow (see lib/ai/invoice-fill.ts for
 * the fill half).
 */
export async function detectDocumentFields(file: PromptFile): Promise<DocumentFieldsResult> {
  const filePart = await buildFilePart(file);
  const promptParts = [buildPrompt(file), filePart];

  let parsed;
  try {
    const raw = await generateJson<unknown>(promptParts, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      timeoutMs: 60_000,
    });
    parsed = responseSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.upstream(
        "The AI field-detection response did not match the expected format.",
        err.flatten()
      );
    }
    throw err;
  }

  return {
    documentType: parsed.documentType,
    detectedLayout: parsed.detectedLayout,
    fields: parsed.fields.map((f, i) => ({ id: `field-${i}`, ...f })),
  };
}
