import { Schema, model, models, type Model, type Document as MongooseDocument, Types } from "mongoose";
import type { ComparisonMode, MatchStatus, Severity, DifferenceType } from "@/types/comparison";
import type { DocumentKind } from "@/types/document";

export interface ComparisonDoc extends MongooseDocument {
  mode: ComparisonMode;
  documentIds: Types.ObjectId[];
  documentKinds: DocumentKind[];
  presetUsed: string;
  toleranceRules: {
    id: string;
    field: string;
    type: "percentage" | "absolute";
    value: number;
    unit: string;
    enabled: boolean;
    category: "pricing" | "quantity" | "dates" | "general";
    description?: string;
  }[];
  fieldDiffs: {
    fieldName: string;
    docAValue: string | number | null;
    docBValue: string | number | null;
    docCValue?: string | number | null;
    severity: Severity;
    differenceType: DifferenceType;
    rootCause: string;
    withinTolerance: boolean;
  }[];
  lineItemDiffs: {
    id: string;
    itemNo: string;
    description: string;
    poQty: number | null;
    grnQty?: number | null;
    invQty: number | null;
    poPrice: number | null;
    invPrice: number | null;
    poTotal: number | null;
    invTotal: number | null;
    qtyVariance: boolean;
    priceVariance: boolean;
    qtyVarianceTag?: string;
    priceVarianceTag?: string;
    explanation: string;
    severity: Severity;
  }[];
  missingItems: Record<string, unknown>[];
  extraItems: Record<string, unknown>[];
  score: {
    matchScore: number;
    lineItemAccuracy: number;
    confidenceScore: number;
    status: MatchStatus;
  };
  financials: {
    totalExpected: number;
    totalInvoiced: number;
    netVariance: number;
    potentialSavings: number;
  };
  aiSummary: string | null;
  aiRecommendation: { decision: "Approve" | "Hold" | "Reject"; reason: string } | null;
  chatHistory: {
    id: string;
    sender: "user" | "ai";
    text: string;
    citations?: { text: string; id: string; page: number; line: number }[];
    timestamp: string;
  }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ToleranceRuleSchema = new Schema(
  {
    id: { type: String, required: true },
    field: { type: String, required: true },
    type: { type: String, enum: ["percentage", "absolute"], required: true },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    category: {
      type: String,
      enum: ["pricing", "quantity", "dates", "general"],
      required: true,
    },
    description: { type: String },
  },
  { _id: false }
);

const FieldDiffSchema = new Schema(
  {
    fieldName: { type: String, required: true },
    docAValue: { type: Schema.Types.Mixed, default: null },
    docBValue: { type: Schema.Types.Mixed, default: null },
    docCValue: { type: Schema.Types.Mixed, default: null },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    differenceType: {
      type: String,
      enum: [
        "missing_field",
        "value_mismatch",
        "quantity_mismatch",
        "price_variance",
        "missing_item",
        "extra_item",
        "tax_mismatch",
        "date_mismatch",
      ],
      required: true,
    },
    rootCause: { type: String, required: true },
    withinTolerance: { type: Boolean, required: true },
  },
  { _id: false }
);

const LineItemDiffSchema = new Schema(
  {
    id: { type: String, required: true },
    itemNo: { type: String, required: true },
    description: { type: String, required: true },
    poQty: { type: Number, default: null },
    grnQty: { type: Number, default: null },
    invQty: { type: Number, default: null },
    poPrice: { type: Number, default: null },
    invPrice: { type: Number, default: null },
    poTotal: { type: Number, default: null },
    invTotal: { type: Number, default: null },
    qtyVariance: { type: Boolean, default: false },
    priceVariance: { type: Boolean, default: false },
    qtyVarianceTag: { type: String },
    priceVarianceTag: { type: String },
    explanation: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema(
  {
    id: { type: String, required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    text: { type: String, required: true },
    citations: {
      type: [
        {
          text: String,
          id: String,
          page: Number,
          line: Number,
        },
      ],
      default: [],
    },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const ComparisonSchema = new Schema<ComparisonDoc>(
  {
    mode: {
      type: String,
      enum: ["2-way", "3-way", "universal", "contract"],
      required: true,
    },
    documentIds: { type: [Schema.Types.ObjectId], ref: "Document", required: true },
    documentKinds: { type: [String], required: true },
    presetUsed: { type: String, required: true },
    toleranceRules: { type: [ToleranceRuleSchema], default: [] },
    fieldDiffs: { type: [FieldDiffSchema], default: [] },
    lineItemDiffs: { type: [LineItemDiffSchema], default: [] },
    missingItems: { type: [Schema.Types.Mixed], default: [] } as any,
    extraItems: { type: [Schema.Types.Mixed], default: [] } as any,
    score: {
      matchScore: { type: Number, required: true },
      lineItemAccuracy: { type: Number, required: true },
      confidenceScore: { type: Number, required: true },
      status: { type: String, enum: ["Matched", "Partial", "Failed"], required: true },
    },
    financials: {
      totalExpected: { type: Number, default: 0 },
      totalInvoiced: { type: Number, default: 0 },
      netVariance: { type: Number, default: 0 },
      potentialSavings: { type: Number, default: 0 },
    },
    aiSummary: { type: String, default: null },
    aiRecommendation: {
      type: {
        decision: { type: String, enum: ["Approve", "Hold", "Reject"] },
        reason: String,
      },
      default: null,
    },
    chatHistory: { type: [ChatMessageSchema], default: [] },
    createdBy: { type: String, default: "admin@company.com" },
  },
  { timestamps: true }
);

export const ComparisonModel: Model<ComparisonDoc> =
  (models.Comparison as Model<ComparisonDoc>) ||
  model<ComparisonDoc>("Comparison", ComparisonSchema);

export default ComparisonModel;
