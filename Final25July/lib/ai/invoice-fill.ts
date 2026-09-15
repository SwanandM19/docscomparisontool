import { z } from "zod";
import type { Part } from "@google/generative-ai";
import { generateJson } from "@/lib/ai/gemini";
import { buildFilePart, type PromptFile } from "@/lib/ai/file-parts";
import { ApiError } from "@/lib/api-utils/errors";
import type { FieldValueInput, InvoiceFillResult } from "@/types/invoice-fill";

const responseSchema = z.object({
  documentType: z.string().min(1),
  detectedLayout: z.string().min(1),
  fields: z
    .array(
      z.object({
        label: z.string(),
        originalValue: z.string().default(""),
        filledValue: z.string().default(""),
        wasBlank: z.boolean().default(true),
        note: z.string().default(""),
      })
    )
    .default([]),
  filledDocument: z.string().min(1),
  unresolved: z.array(z.string()).default([]),
});

const SYSTEM_INSTRUCTION = `You are a document-completion assistant. The user gives you ONE document —
their own invoice, bill, or form — plus an exact list of field values they typed in on the website for
that document's own detected fields. Your job:

1. Read the document and understand its exact layout: its title, every labelled field, every table
   column, headings, and where the blanks are.
2. Fill each field using EXACTLY the value supplied for it. Do not alter, reinterpret, or second-guess
   a supplied value.
3. For fields the user left empty, you may compute a value ONLY when it is a direct arithmetic
   consequence of other supplied values on the same document (e.g. line amount = quantity × rate,
   subtotal, tax, grand total) — do the arithmetic yourself and keep it consistent across the document.
   Otherwise leave the field blank and list its label in "unresolved".
4. Never remove or rewrite text that was already printed on the document. Never invent parties,
   numbers, GSTINs, or dates that were not supplied or directly computable.
5. Checkboxes / radio-style options (e.g. "Male / Female / Other", "Yes / No"): these are one logical
   choice split into several individual fields, one per option. Decide the choice from whatever value
   was supplied for the field they belong to (e.g. a "Gender" value of "Male" selects the "Male" option
   field and deselects the others). Mark the selected option's field with "[x]" and every other option
   in that same group with "[ ]" — in BOTH the "fields" array's "filledValue" AND the matching spot in
   "filledDocument". These two must never disagree.
6. Preserve the document's structure in "filledDocument": same headings, same field order, table
   rows aligned as plain-text columns, same sections. It should read like the original document,
   just completed.
7. Before returning, verify every single value in "fields" appears at its correct place in
   "filledDocument" exactly as written there — treat any mismatch between the two as a mistake to fix,
   not an acceptable inconsistency.

Currency: use whatever the document specifies; default to the Indian Rupee symbol ₹ if the document is
an Indian invoice and nothing else is stated.

Return ONLY a single JSON object matching the schema — no markdown, no commentary.`;

function buildPrompt(file: PromptFile, fields: FieldValueInput[], notes: string): string {
  const fieldLines = fields
    .map((f) => `- "${f.label}": ${f.value.trim() ? `"${f.value}"` : "(left empty by the user)"}`)
    .join("\n");

  return `Uploaded document: "${file.fileName}"

Field values supplied by the user (matches this document's own detected fields, in order):
${fieldLines || "(no fields supplied)"}
${notes.trim() ? `\nAdditional notes from the user:\n"""\n${notes.trim()}\n"""\n` : ""}
Return a JSON object with EXACTLY this shape:
{
  "documentType": string,
  "detectedLayout": string,
  "fields": [
    { "label": string, "originalValue": string, "filledValue": string, "wasBlank": boolean, "note": string }
  ],
  "filledDocument": string,
  "unresolved": [string]
}

- "fields" must list every fillable field on the document, in the order they appear, with the value
  you put in it. For table line items, use labels like "Line 1 — Description", "Line 1 — Qty", etc.
- "filledDocument" is the whole document as plain text with your values filled in and the layout
  preserved. Use "\\n" for line breaks.
- For any checkbox/option field, the mark you put in "fields" ("[x]" or "[ ]") MUST be the exact same
  mark that appears for that option in "filledDocument" — do not leave "filledDocument" unmarked while
  "fields" records a selection, or vice versa.`;
}

/**
 * Fills an uploaded document's blank fields using the exact per-field values
 * the user typed in on the website — the fill half of the Document Filler's
 * detect-then-fill flow (see lib/ai/document-fields.ts for the detect half).
 */
export async function fillDocumentFields(
  file: PromptFile,
  fields: FieldValueInput[],
  notes = ""
): Promise<InvoiceFillResult> {
  const filePart = await buildFilePart(file);
  const promptParts: (string | Part)[] = [buildPrompt(file, fields, notes), filePart];

  let parsed;
  try {
    const raw = await generateJson<unknown>(promptParts, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.15,
      timeoutMs: 90_000,
    });
    parsed = responseSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.upstream(
        "The AI fill response did not match the expected format.",
        err.flatten()
      );
    }
    throw err;
  }

  return {
    documentType: parsed.documentType,
    detectedLayout: parsed.detectedLayout,
    fields: parsed.fields.map((f, i) => ({ id: `field-${i}`, ...f })),
    filledDocument: parsed.filledDocument,
    unresolved: parsed.unresolved,
  };
}
