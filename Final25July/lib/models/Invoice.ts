import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";
import type { InvoiceData, InvoiceStatus, InvoiceTotals } from "@/types/invoice";

export interface InvoiceDoc extends MongooseDocument {
  data: InvoiceData;
  totals: InvoiceTotals;
  status: InvoiceStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartySchema = new Schema(
  {
    name: { type: String, default: "" },
    address: { type: String, default: "" },
    gstin: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { _id: false }
);

const LineItemSchema = new Schema(
  {
    id: { type: String, required: true },
    description: { type: String, default: "" },
    hsn: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const DataSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: String, default: "" },
    dueDate: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    taxMode: { type: String, enum: ["cgst_sgst", "igst", "none"], default: "cgst_sgst" },
    seller: { type: PartySchema, default: () => ({}) },
    buyer: { type: PartySchema, default: () => ({}) },
    lineItems: { type: [LineItemSchema], default: [] },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
  },
  { _id: false }
);

const TaxLineSchema = new Schema(
  {
    label: { type: String, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const TotalsSchema = new Schema(
  {
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    taxLines: { type: [TaxLineSchema], default: [] },
    totalTax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<InvoiceDoc>(
  {
    data: { type: DataSchema, required: true },
    totals: { type: TotalsSchema, required: true },
    status: { type: String, enum: ["draft", "final"], default: "draft", index: true },
    createdBy: { type: String, default: "admin@company.com", index: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ createdAt: -1 });

export const InvoiceModel: Model<InvoiceDoc> =
  (models.Invoice as Model<InvoiceDoc>) || model<InvoiceDoc>("Invoice", InvoiceSchema);

export default InvoiceModel;
