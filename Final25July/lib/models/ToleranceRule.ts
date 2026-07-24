import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";

export interface ToleranceRuleDoc extends MongooseDocument {
  field: string;
  type: "percentage" | "absolute";
  value: number;
  unit: string;
  enabled: boolean;
  category: "pricing" | "quantity" | "dates" | "general";
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const ToleranceRuleSchema = new Schema<ToleranceRuleDoc>(
  {
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
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

export const ToleranceRuleModel: Model<ToleranceRuleDoc> =
  (models.ToleranceRule as Model<ToleranceRuleDoc>) ||
  model<ToleranceRuleDoc>("ToleranceRule", ToleranceRuleSchema);

export default ToleranceRuleModel;

/**
 * Seed values matching the frontend's original hardcoded defaults
 * (components/dashboard/tolerance-settings.tsx). Used to populate a
 * fresh database on first request so the Settings page is never empty.
 */
export const DEFAULT_TOLERANCE_RULES: Omit<ToleranceRuleDoc, keyof MongooseDocument | "createdAt" | "updatedAt">[] = [
  {
    field: "Unit Price",
    type: "percentage",
    value: 2,
    unit: "%",
    enabled: true,
    description: "Allow up to 2% variation in unit prices",
    category: "pricing",
  } as never,
  {
    field: "Total Amount",
    type: "percentage",
    value: 1,
    unit: "%",
    enabled: true,
    description: "Allow up to 1% variation in total invoice amount",
    category: "pricing",
  } as never,
  {
    field: "Quantity",
    type: "absolute",
    value: 5,
    unit: "units",
    enabled: true,
    description: "Allow up to 5 units variance between ordered and received/billed quantity",
    category: "quantity",
  } as never,
  {
    field: "Document Date",
    type: "absolute",
    value: 7,
    unit: "days",
    enabled: true,
    description: "Allow up to 7 days difference between document dates",
    category: "dates",
  } as never,
  {
    field: "Tax Amount",
    type: "percentage",
    value: 1,
    unit: "%",
    enabled: true,
    description: "Allow up to 1% variation in computed tax amounts",
    category: "pricing",
  } as never,
];
