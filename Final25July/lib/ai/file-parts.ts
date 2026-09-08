import mammoth from "mammoth";
import type { Part } from "@google/generative-ai";
import { fileUrlToInlinePart } from "@/lib/ai/gemini";
import { ApiError } from "@/lib/api-utils/errors";

/**
 * The minimum shape needed to turn an uploaded file into a Gemini prompt
 * part. Structurally satisfied by `IntelligentSourceFile`,
 * `TranslationSourceFile`, and anything else carrying these four fields.
 */
export interface PromptFile {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileType: "pdf" | "image" | "word" | "excel" | "text";
}

/** Ceiling on locally-extracted text passed to the model, in characters. */
export const MAX_TEXT_PART_CHARS = 120_000;

/**
 * Builds the Gemini `Part` for one uploaded file.
 *
 * PDFs and images go up as inline data so the model can read layout and
 * scanned content directly. Word / spreadsheet / plain-text binaries are
 * unreliable on Gemini's inline-data path, so their text is extracted
 * locally and passed as a text part instead.
 */
export async function buildFilePart(file: PromptFile): Promise<Part> {
  if (file.fileType === "pdf" || file.fileType === "image") {
    return fileUrlToInlinePart(file.fileUrl, file.mimeType);
  }

  const text = await extractFileText(file);
  return { text: `Text content of "${file.fileName}":\n\n${text}` } as Part;
}

/**
 * Downloads a non-PDF/image file and returns its text, truncated to
 * `MAX_TEXT_PART_CHARS`. Exported separately so callers that need to know
 * whether truncation happened (e.g. translation) can check the length.
 */
export async function extractFileText(file: PromptFile): Promise<string> {
  const res = await fetch(file.fileUrl);
  if (!res.ok) {
    throw ApiError.upstream(
      `Failed to fetch "${file.fileName}" for analysis: ${res.status} ${res.statusText}`
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  let text: string;
  if (file.fileType === "word") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    // csv / xls(x) exported as text / plain text — best effort.
    text = buffer.toString("utf-8");
  }

  return text.slice(0, MAX_TEXT_PART_CHARS);
}
