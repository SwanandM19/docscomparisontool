/**
 * Types for the Document Filler's two-phase flow: the user uploads their own
 * invoice / form / template, the AI detects its fields (flagging which are
 * blank), the user types a value into each one, and on their click the AI
 * fills the document while preserving its layout.
 */

export interface DetectedField {
  id: string;
  /** The field's label as it appears on the document. */
  label: string;
  /** What was already printed there (empty for a blank field). */
  originalValue: string;
  /** True when the field is blank on the uploaded document. */
  isBlank: boolean;
}

export interface DocumentFieldsResult {
  documentType: string;
  /** Plain-language description of the uploaded document's structure. */
  detectedLayout: string;
  fields: DetectedField[];
}

/** One field's user-supplied value, sent back for the fill step. */
export interface FieldValueInput {
  id: string;
  label: string;
  value: string;
}

export interface FilledField {
  id: string;
  /** The field's label as it appears on the document. */
  label: string;
  /** What was already printed there (usually empty for a blank form). */
  originalValue: string;
  /** The value filled in — the user's supplied value, or a computed one. */
  filledValue: string;
  /** True when the field was blank on the uploaded document. */
  wasBlank: boolean;
  /** Optional note, e.g. "computed as qty × rate" or "not specified". */
  note: string;
}

export interface InvoiceFillResult {
  documentType: string;
  /** Plain-language description of the uploaded document's structure. */
  detectedLayout: string;
  fields: FilledField[];
  /**
   * The full document text with every blank filled and the original layout
   * (headings, table rows, spacing) preserved as plain text.
   */
  filledDocument: string;
  /** Fields left blank because no value was supplied for them. */
  unresolved: string[];
}
