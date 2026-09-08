import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";
import type {
  IntelligentSourceFile,
  IntelligentDocumentSummary,
  IntelligentComparisonResult,
} from "@/types/intelligent";

export interface IntelligentComparisonDoc extends MongooseDocument {
  files: IntelligentSourceFile[];
  documentSummaries: IntelligentDocumentSummary[];
  comparison: IntelligentComparisonResult;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SourceFileSchema = new Schema<IntelligentSourceFile>(
  {
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    fileType: {
      type: String,
      enum: ["pdf", "image", "word", "excel", "text"],
      required: true,
    },
  },
  { _id: false }
);

const DocumentSummarySchema = new Schema<IntelligentDocumentSummary>(
  {
    index: { type: Number, required: true },
    fileName: { type: String, required: true },
    detectedType: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    keyPoints: { type: [String], default: [] },
  },
  { _id: false }
);

const AlignedFindingSchema = new Schema(
  {
    aspect: { type: String, required: true },
    status: {
      type: String,
      enum: ["match", "partial", "mismatch", "only_in_one"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
    },
    perDocument: {
      type: [{ index: Number, value: String }],
      default: [],
    },
    details: { type: String, required: true },
  },
  { _id: false }
);

const ComparisonSchema = new Schema<IntelligentComparisonResult>(
  {
    documentsCompared: { type: String, required: true },
    overview: { type: String, required: true },
    alignedFindings: { type: [AlignedFindingSchema], default: [] },
    keySimilarities: { type: [String], default: [] },
    keyDifferences: { type: [String], default: [] },
    verdict: {
      rating: {
        type: String,
        enum: ["Strong Match", "Partial Match", "Weak Match", "Divergent"],
        required: true,
      },
      rationale: { type: String, required: true },
    },
  },
  { _id: false }
);

const IntelligentComparisonSchema = new Schema<IntelligentComparisonDoc>(
  {
    files: { type: [SourceFileSchema], required: true },
    documentSummaries: { type: [DocumentSummarySchema], default: [] },
    comparison: { type: ComparisonSchema, required: true },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export const IntelligentComparisonModel: Model<IntelligentComparisonDoc> =
  (models.IntelligentComparison as Model<IntelligentComparisonDoc>) ||
  model<IntelligentComparisonDoc>("IntelligentComparison", IntelligentComparisonSchema);

export default IntelligentComparisonModel;
