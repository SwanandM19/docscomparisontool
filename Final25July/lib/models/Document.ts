import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";
import type { DocumentFileType, DocumentKind, DocumentStatus, ExtractedDocumentData } from "@/types/document";

export interface DocumentDoc extends MongooseDocument {
  kind: DocumentKind;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: DocumentFileType;
  status: DocumentStatus;
  extractedData: ExtractedDocumentData | null;
  extractionConfidence: number | null;
  extractionError: string | null;
  aiSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaxDetailSchema = new Schema(
  {
    taxType: { type: String, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const LineItemSchema = new Schema(
  {
    itemNo: { type: String },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const ExtractedDataSchema = new Schema(
  {
    documentType: {
      type: String,
      enum: ["PO", "GRN", "Invoice", "Contract"],
      required: true,
    },
    vendorName: { type: String, default: null },
    vendorGSTIN: { type: String, default: null },
    poNumber: { type: String, default: null },
    invoiceNumber: { type: String, default: null },
    grnNumber: { type: String, default: null },
    documentDate: { type: String, default: null },
    currency: { type: String, default: null },
    totalAmount: { type: Number, default: null },
    taxDetails: { type: [TaxDetailSchema], default: [] },
    lineItems: { type: [LineItemSchema], default: [] },
    rawText: { type: String },
  },
  { _id: false }
);

const DocumentSchema = new Schema<DocumentDoc>(
  {
    kind: {
      type: String,
      enum: ["PO", "GRN", "Invoice", "Contract"],
      required: true,
      index: true,
    },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    fileType: {
      type: String,
      enum: ["pdf", "image", "excel", "word"],
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "extracting", "extracted", "failed"],
      default: "uploaded",
      index: true,
    },
    extractedData: { type: ExtractedDataSchema, default: null },
    extractionConfidence: { type: Number, default: null },
    extractionError: { type: String, default: null },
    aiSummary: { type: String, default: null },
  },
  { timestamps: true }
);

export const DocumentModel: Model<DocumentDoc> =
  (models.Document as Model<DocumentDoc>) || model<DocumentDoc>("Document", DocumentSchema);

export default DocumentModel;
