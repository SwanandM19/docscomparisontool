import type {
  InvoiceData,
  InvoiceLineItem,
  InvoiceTaxLine,
  InvoiceTotals,
} from "@/types/invoice";

/** Rounds to 2 decimals without float drift (0.1 + 0.2 style artifacts). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Line amount before tax. */
export function lineAmount(item: Pick<InvoiceLineItem, "quantity" | "unitPrice">): number {
  return round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
}

/**
 * Computes every derived figure on an invoice.
 *
 * Single source of truth — the form preview, the saved record, and the PDF
 * all call this, so what the user sees on screen is exactly what gets
 * stored and printed.
 *
 * Tax is charged on the discounted taxable value, with the discount spread
 * across line items in proportion to their amount. That matches how GST is
 * applied to a document-level discount in practice.
 */
export function calculateInvoice(data: InvoiceData): InvoiceTotals {
  const items = data.lineItems ?? [];

  const subtotal = round2(items.reduce((sum, item) => sum + lineAmount(item), 0));
  const discount = round2(Math.min(Math.max(Number(data.discount) || 0, 0), subtotal));
  const taxableValue = round2(subtotal - discount);
  const shipping = round2(Number(data.shipping) || 0);

  // Proportional share of the discount that applies to each line.
  const discountRatio = subtotal > 0 ? discount / subtotal : 0;

  // Group taxable value by rate so the invoice shows one row per rate,
  // the way a GST invoice is conventionally laid out.
  const byRate = new Map<number, number>();
  if (data.taxMode !== "none") {
    for (const item of items) {
      const rate = Number(item.taxRate) || 0;
      if (rate <= 0) continue;
      const base = lineAmount(item) * (1 - discountRatio);
      byRate.set(rate, (byRate.get(rate) ?? 0) + base);
    }
  }

  const taxLines: InvoiceTaxLine[] = [];
  for (const [rate, base] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
    if (data.taxMode === "cgst_sgst") {
      // An 18% rate is levied as 9% CGST + 9% SGST.
      const half = round2((base * rate) / 200);
      taxLines.push({ label: `CGST ${rate / 2}%`, rate: rate / 2, amount: half });
      taxLines.push({ label: `SGST ${rate / 2}%`, rate: rate / 2, amount: half });
    } else {
      taxLines.push({
        label: `IGST ${rate}%`,
        rate,
        amount: round2((base * rate) / 100),
      });
    }
  }

  const totalTax = round2(taxLines.reduce((sum, line) => sum + line.amount, 0));
  const grandTotal = round2(taxableValue + totalTax + shipping);

  return { subtotal, discount, taxableValue, taxLines, totalTax, shipping, grandTotal };
}

/** Formats an amount for display, e.g. `₹1,23,456.00` for INR. */
export function formatAmount(value: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
