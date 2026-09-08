import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";
import type {
  TranslationDirection,
  TranslationResult,
  TranslationSourceFile,
} from "@/types/translation";

export interface TranslationDoc extends MongooseDocument {
  file: TranslationSourceFile;
  direction: TranslationDirection;
  result: TranslationResult;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SourceFileSchema = new Schema(
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

const ResultSchema = new Schema(
  {
    detectedLanguage: { type: String, enum: ["en", "mr", "other"], required: true },
    directionMismatch: { type: Boolean, default: false },
    sourceText: { type: String, default: "" },
    translatedText: { type: String, required: true },
    confidence: { type: Number, default: 0 },
    truncated: { type: Boolean, default: false },
  },
  { _id: false }
);

const TranslationSchema = new Schema<TranslationDoc>(
  {
    file: { type: SourceFileSchema, required: true },
    direction: { type: String, enum: ["en-mr", "mr-en"], required: true, index: true },
    result: { type: ResultSchema, required: true },
    createdBy: { type: String, default: "admin@company.com", index: true },
  },
  { timestamps: true }
);

TranslationSchema.index({ createdAt: -1 });

export const TranslationModel: Model<TranslationDoc> =
  (models.Translation as Model<TranslationDoc>) ||
  model<TranslationDoc>("Translation", TranslationSchema);

export default TranslationModel;
