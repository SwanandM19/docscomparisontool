/**
 * Shared document types used across backend services and the frontend.
 * These mirror the shapes stored in MongoDB (see lib/models/Document.ts).
 */

export type DocumentKind = "PO" | "GRN" | "Invoice" | "Contract";

export type DocumentFileType = "pdf" | "image" | "excel" | "word";

export type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "failed";

export interface TaxDetail {
  taxType: string; // e.g. "CGST", "SGST", "IGST", "VAT"
  rate: number; // percentage
  amount: number;
}

export interface ExtractedLineItem {
  itemNo?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * The normalized, structured payload the AI extraction step must produce
 * for every supported document type. Optional fields simply won't apply
 * to every document kind (e.g. GRNs rarely have tax details).
 */
export interface ExtractedDocumentData {
  documentType: DocumentKind;
  vendorName: string | null;
  vendorGSTIN: string | null;
  poNumber: string | null;
  invoiceNumber: string | null;
  grnNumber: string | null;
  documentDate: string | null; // ISO date string
  currency: string | null;
  totalAmount: number | null;
  taxDetails: TaxDetail[];
  lineItems: ExtractedLineItem[];
  rawText?: string; // fallback raw text if structured parse partially failed
}

export interface DocumentRecord {
  _id: string;
  kind: DocumentKind;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: DocumentFileType;
  uploadedAt: string;
  status: DocumentStatus;
  extractedData: ExtractedDocumentData | null;
  extractionConfidence: number | null;
  extractionError?: string | null;
  aiSummary?: string | null;
}
