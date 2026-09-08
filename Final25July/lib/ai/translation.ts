import { z } from "zod";
import type { Part } from "@google/generative-ai";
import { generateJson } from "@/lib/ai/gemini";
import { buildFilePart, MAX_TEXT_PART_CHARS } from "@/lib/ai/file-parts";
import { ApiError } from "@/lib/api-utils/errors";
import {
  LANGUAGE_LABELS,
  directionSource,
  directionTarget,
  type TranslationDirection,
  type TranslationResult,
  type TranslationSourceFile,
} from "@/types/translation";

const responseSchema = z.object({
  detectedLanguage: z.enum(["en", "mr", "other"]),
  sourceText: z.string(),
  translatedText: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_INSTRUCTION = `You are a professional translator working exclusively between English and
Marathi (मराठी). You are given a business document — an invoice, purchase order, contract, letter,
report, receipt, or similar — as a file or as extracted text.

Your job has two parts:
1. Transcribe the document's text faithfully, in its original language and reading order.
2. Translate that text into the requested target language.

Translation rules:
- Translate meaning, not words. Produce natural, fluent prose that a native speaker would write —
  never a literal word-by-word rendering.
- Preserve the document's structure exactly: keep headings as headings, lists as lists, tables as
  aligned plain-text rows, and keep paragraph and line breaks in the same places. The translated
  text must be laid out the same way as the source text.
- Do NOT translate: numbers, dates, amounts, currency symbols, invoice/PO/GRN numbers, GSTINs,
  PAN numbers, email addresses, URLs, phone numbers, or product/model codes. Copy them verbatim.
- Proper nouns (people, companies, places) stay in their original script unless a standard,
  widely-used equivalent exists in the target language.
- For Marathi output use the Devanagari script. For technical or legal terms with no settled
  Marathi equivalent, use the accepted Marathi term followed by the English term in parentheses
  on first use only.
- If part of the document is illegible, write [अस्पष्ट] in Marathi output or [illegible] in
  English output at that point rather than guessing.
- Never add commentary, notes, summaries, or content that is not in the source document.

Respond with ONLY a single JSON object matching the schema you are given — no markdown, no code
fences, no commentary.`;

function buildPrompt(file: TranslationSourceFile, direction: TranslationDirection): string {
  const from = LANGUAGE_LABELS[directionSource(direction)];
  const to = LANGUAGE_LABELS[directionTarget(direction)];

  return `Translate the attached document "${file.fileName}" from ${from} into ${to}.

Return a JSON object with EXACTLY this shape:
{
  "detectedLanguage": "en" | "mr" | "other",
  "sourceText": string,
  "translatedText": string,
  "confidence": number
}

Field rules:
- "detectedLanguage" is the language the document is ACTUALLY written in, judged from its content.
  Use "en" for English, "mr" for Marathi, and "other" for anything else. Report what you observe —
  the user expects ${from}, but say so honestly if it differs.
- "sourceText" is your faithful transcription of the document in its ORIGINAL language, with the
  original line breaks and structure preserved.
- "translatedText" is "sourceText" rendered into ${to}, following your translation rules. Even if
  "detectedLanguage" is not "${directionSource(direction)}", still translate the content into ${to}.
- "confidence" is your own 0.0-1.0 estimate of how accurate the transcription and translation are,
  accounting for legibility, handwriting, scan quality, and ambiguous terms.

Use "\\n" for line breaks inside the JSON strings.`;
}

/**
 * Translates an uploaded document between English and Marathi.
 *
 * The document is sent to Gemini whole (inline for PDFs/images, as locally
 * extracted text otherwise) so the model can use layout and context rather
 * than translating disconnected fragments.
 */
export async function translateDocument(
  file: TranslationSourceFile,
  direction: TranslationDirection
): Promise<TranslationResult> {
  const filePart = await buildFilePart(file);

  // Text parts are capped at MAX_TEXT_PART_CHARS by extractFileText, so a
  // part sitting exactly on the ceiling was almost certainly cut short.
  const partText = typeof filePart === "object" && "text" in filePart ? filePart.text : undefined;
  const truncated = typeof partText === "string" && partText.length >= MAX_TEXT_PART_CHARS;

  const promptParts: (string | Part)[] = [buildPrompt(file, direction), filePart];

  let parsed;
  try {
    const raw = await generateJson<unknown>(promptParts, {
      systemInstruction: SYSTEM_INSTRUCTION,
      // Translation should be faithful and repeatable, not creative.
      temperature: 0.1,
      timeoutMs: 90_000,
    });
    parsed = responseSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.upstream(
        "The AI translation response did not match the expected format.",
        err.flatten()
      );
    }
    throw err;
  }

  return {
    detectedLanguage: parsed.detectedLanguage,
    directionMismatch: parsed.detectedLanguage !== directionSource(direction),
    sourceText: parsed.sourceText,
    translatedText: parsed.translatedText,
    confidence: parsed.confidence,
    truncated,
  };
}
