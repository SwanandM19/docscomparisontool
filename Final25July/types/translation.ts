/**
 * Types for the Document Translation section — translation of an uploaded
 * document between any two supported languages (see lib/ai/translation.ts).
 * Originally limited to English ⇄ Marathi; widened to the language list
 * below, but "en-mr"/"mr-en" keep working exactly as before since they're
 * just one pair among the set.
 */

export type TranslationLanguage =
  | "en"
  | "mr"
  | "hi"
  | "gu"
  | "bn"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "pa"
  | "de"
  | "fr"
  | "es"
  | "ja"
  | "zh";

export const LANGUAGE_CODES: TranslationLanguage[] = [
  "en",
  "mr",
  "hi",
  "gu",
  "bn",
  "ta",
  "te",
  "kn",
  "ml",
  "pa",
  "de",
  "fr",
  "es",
  "ja",
  "zh",
];

/** Any "source-target" pair of supported languages, e.g. "en-mr", "hi-ta". */
export type TranslationDirection = `${TranslationLanguage}-${TranslationLanguage}`;

export function isTranslationLanguage(value: string): value is TranslationLanguage {
  return (LANGUAGE_CODES as string[]).includes(value);
}

/** Validates a "source-target" direction string: both known languages, and distinct. */
export function isTranslationDirection(value: string): value is TranslationDirection {
  const [source, target] = value.split("-");
  return (
    source !== undefined &&
    target !== undefined &&
    isTranslationLanguage(source) &&
    isTranslationLanguage(target) &&
    source !== target
  );
}

export type TranslationFileType = "pdf" | "image" | "word" | "excel" | "text" | "rtf";

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
  hi: "Hindi",
  gu: "Gujarati",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  de: "German",
  fr: "French",
  es: "Spanish",
  ja: "Japanese",
  zh: "Chinese",
};

export function directionSource(direction: TranslationDirection): TranslationLanguage {
  return direction.split("-")[0] as TranslationLanguage;
}

export function directionTarget(direction: TranslationDirection): TranslationLanguage {
  return direction.split("-")[1] as TranslationLanguage;
}

/** Human-readable "Source → Target" label for any supported direction. */
export function directionLabel(direction: TranslationDirection): string {
  return `${LANGUAGE_LABELS[directionSource(direction)]} → ${LANGUAGE_LABELS[directionTarget(direction)]}`;
}

/**
 * Kept for the two directions the UI ships as quick-pick defaults; any other
 * pair is still fully supported via directionLabel() above.
 */
export const DIRECTION_LABELS: Record<"en-mr" | "mr-en", string> = {
  "en-mr": "English → Marathi",
  "mr-en": "Marathi → English",
};
