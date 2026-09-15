/**
 * Types for the standalone Document Summary section — upload one or more
 * documents of any type and get a detailed structured summary of each.
 */

export type SummaryFileType = "pdf" | "image" | "word" | "excel" | "text" | "rtf";

export interface SummarySourceFile {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: SummaryFileType;
}

export interface LabelledValue {
  label: string;
  value: string;
}

export interface SummaryLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface SummaryParty {
  role: string;
  name: string;
  details: string;
}

export interface DocumentSummary {
  fileName: string;
  documentType: string;
  title: string;
  /** A detailed plain-language paragraph, 3–7 sentences. */
  overview: string;
  parties: SummaryParty[];
  keyFields: LabelledValue[];
  dates: LabelledValue[];
  financials: LabelledValue[];
  lineItems: SummaryLineItem[];
  /** Notable points — large totals, missing fields, risks, unusual terms. */
  highlights: string[];
}

export interface SummarizeResponse {
  documents: DocumentSummary[];
}
