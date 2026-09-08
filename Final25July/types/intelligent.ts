/**
 * Types for the Intelligent Comparison section — an AI-driven, schema-free
 * comparison of any documents (CV vs job description, contract revisions,
 * PO vs invoice, report vs report, …). Unlike the procurement engine in
 * lib/comparison/, nothing here is locked to vendor/PO/line-item fields.
 */

export type IntelligentFileType = "pdf" | "image" | "word" | "excel" | "text";

export interface IntelligentSourceFile {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: IntelligentFileType;
}

export interface IntelligentDocumentSummary {
  index: number;
  fileName: string;
  detectedType: string; // free-form, e.g. "Resume / CV", "Purchase Order", "Service Agreement"
  title: string; // a short human title for the document
  summary: string; // plain-language, generic — works for any document kind
  keyPoints: string[];
}

export type AlignedStatus = "match" | "partial" | "mismatch" | "only_in_one";

export interface IntelligentAlignedFinding {
  aspect: string; // what is being compared, e.g. "Required experience", "Payment terms", "Total amount"
  status: AlignedStatus;
  severity: "low" | "medium" | "high" | "critical";
  perDocument: { index: number; value: string }[];
  details: string; // explanation of the relationship / discrepancy
}

export interface IntelligentComparisonResult {
  documentsCompared: string; // one-line description of the pairing, e.g. "Resume vs Job Description"
  overview: string; // 2-4 sentence executive overview of how the documents relate
  alignedFindings: IntelligentAlignedFinding[];
  keySimilarities: string[];
  keyDifferences: string[];
  verdict: {
    rating: "Strong Match" | "Partial Match" | "Weak Match" | "Divergent";
    rationale: string;
  };
}

export interface IntelligentComparisonRecord {
  _id: string;
  files: IntelligentSourceFile[];
  documentSummaries: IntelligentDocumentSummary[];
  comparison: IntelligentComparisonResult;
  createdBy: string;
  createdAt: string;
}
