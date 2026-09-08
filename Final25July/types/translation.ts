/**
 * Types for the Document Translation section — English ⇄ Marathi translation
 * of an uploaded document. Deliberately limited to this one language pair
 * (see lib/ai/translation.ts) so the prompt can be tuned for it.
 */

export type TranslationLanguage = "en" | "mr";

/** The only two directions this feature supports. */
export type TranslationDirection = "en-mr" | "mr-en";

export type TranslationFileType = "pdf" | "image" | "word" | "excel" | "text";

export interface TranslationSourceFile {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: TranslationFileType;
}

export interface TranslationResult {
  /** Language the model actually detected in the document. */
  detectedLanguage: TranslationLanguage | "other";
  /**
   * True when `detectedLanguage` doesn't match the direction the user picked.
   * The translation is still returned — the UI just warns about it rather
   * than failing, since detection on scanned/mixed documents isn't perfect.
   */
  directionMismatch: boolean;
  /** The document's original text, transcribed by the model. */
  sourceText: string;
  /** The translated text, structure preserved. */
  translatedText: string;
  /** Model's own 0-1 confidence in the transcription + translation. */
  confidence: number;
  /** True when the document was too long and was translated only in part. */
  truncated: boolean;
}

export interface TranslationRecord {
  _id: string;
  file: TranslationSourceFile;
  direction: TranslationDirection;
  result: TranslationResult;
  createdBy: string;
  createdAt: string;
}

export const LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  en: "English",
  mr: "Marathi",
};

export const DIRECTION_LABELS: Record<TranslationDirection, string> = {
  "en-mr": "English → Marathi",
  "mr-en": "Marathi → English",
};

export function directionSource(direction: TranslationDirection): TranslationLanguage {
  return direction === "en-mr" ? "en" : "mr";
}

export function directionTarget(direction: TranslationDirection): TranslationLanguage {
  return direction === "en-mr" ? "mr" : "en";
}
