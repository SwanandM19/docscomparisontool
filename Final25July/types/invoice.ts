/**
 * Types for the Invoice Builder — a fill-in-the-blanks invoice template that
 * produces a downloadable/shareable PDF. Mirrors lib/models/Invoice.ts.
 */

/**
 * How tax is applied across the invoice:
 * - "cgst_sgst": intra-state supply — each item's rate splits evenly into CGST + SGST.
 * - "igst":      inter-state supply — each item's rate is charged as a single IGST line.
 * - "none":      no GST (exports, exempt supplies, non-GST invoices).
 */
export type InvoiceTaxMode = "cgst_sgst" | "igst" | "none";

export type InvoiceStatus = "draft" | "final";

export interface InvoiceParty {
  name: string;
  address: string;
  gstin: string;
  email: string;
  phone: string;
}

export interface InvoiceLineItem {
  /** Client-side row key; not meaningful once saved. */
  id: string;
  description: string;
  /** HSN (goods) or SAC (services) code — optional but expected on GST invoices. */
  hsn: string;
  quantity: number;
  unitPrice: number;
  /** Percentage, e.g. 18 for 18%. */
  taxRate: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  /** ISO date string (YYYY-MM-DD). */
  invoiceDate: string;
  /** ISO date string (YYYY-MM-DD); empty when not applicable. */
  dueDate: string;
  /** ISO 4217 code. Defaults to INR. */
  currency: string;
  taxMode: InvoiceTaxMode;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  lineItems: InvoiceLineItem[];
  /** Flat amount taken off the subtotal before tax. */
  discount: number;
  /** Flat amount added after tax (freight, packing, round-off). */
  shipping: number;
  notes: string;
  terms: string;
}

/** One tax bucket, grouped by rate — how GST invoices are conventionally shown. */
export interface InvoiceTaxLine {
  label: string; // e.g. "CGST 9%", "IGST 18%"
  rate: number;
  amount: number;
}

export interface InvoiceTotals {
  /** Sum of quantity × unitPrice across all line items, before discount. */
  subtotal: number;
  discount: number;
  /** subtotal − discount; the base tax is charged on. */
  taxableValue: number;
  taxLines: InvoiceTaxLine[];
  totalTax: number;
  shipping: number;
  grandTotal: number;
}

export interface InvoiceRecord {
  _id: string;
  data: InvoiceData;
  totals: InvoiceTotals;
  status: InvoiceStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const TAX_MODE_LABELS: Record<InvoiceTaxMode, string> = {
  cgst_sgst: "CGST + SGST (intra-state)",
  igst: "IGST (inter-state)",
  none: "No tax",
};

/** Currency symbols for the handful of currencies worth offering here. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}
