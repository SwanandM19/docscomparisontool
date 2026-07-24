import type { DocumentKind, ExtractedLineItem } from "./document";

export type ComparisonMode = "2-way" | "3-way" | "universal" | "contract";

export type Severity = "low" | "medium" | "high" | "critical";

export type DifferenceType =
  | "missing_field"
  | "value_mismatch"
  | "quantity_mismatch"
  | "price_variance"
  | "missing_item"
  | "extra_item"
  | "tax_mismatch"
  | "date_mismatch";

export interface FieldDiff {
  fieldName: string;
  docAValue: string | number | null;
  docBValue: string | number | null;
  docCValue?: string | number | null;
  severity: Severity;
  differenceType: DifferenceType;
  rootCause: string;
  withinTolerance: boolean;
}

export interface LineItemDiff {
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
}

export type MatchStatus = "Matched" | "Partial" | "Failed";

export interface ToleranceRuleInput {
  id?: string;
  field: string;
  type: "percentage" | "absolute";
  value: number;
  unit: string;
  enabled: boolean;
  category: "pricing" | "quantity" | "dates" | "general";
  description?: string;
}

export interface ComparisonScore {
  matchScore: number; // 0-100 overall
  lineItemAccuracy: number; // 0-100
  confidenceScore: number; // 0-100, derived from extraction confidence of inputs
  status: MatchStatus;
}

export interface ComparisonResultPayload {
  _id: string;
  mode: ComparisonMode;
  documentIds: string[];
  documentKinds: DocumentKind[];
  presetUsed: string;
  toleranceRules: ToleranceRuleInput[];
  fieldDiffs: FieldDiff[];
  lineItemDiffs: LineItemDiff[];
  missingItems: ExtractedLineItem[];
  extraItems: ExtractedLineItem[];
  score: ComparisonScore;
  financials: {
    totalExpected: number;
    totalInvoiced: number;
    netVariance: number;
    potentialSavings: number;
  };
  aiSummary: string | null;
  aiRecommendation: {
    decision: "Approve" | "Hold" | "Reject";
    reason: string;
  } | null;
  chatHistory: ChatMessageRecord[];
  createdAt: string;
  createdBy: string;
}

export interface ChatMessageRecord {
  id: string;
  sender: "user" | "ai";
  text: string;
  citations?: { text: string; id: string; page: number; line: number }[];
  timestamp: string;
}
