import type { ComparisonMode } from "@/types/comparison";

/**
 * Shared between the results screen and the PDF export so a Universal or
 * Contract comparison presents consistently in both places, instead of
 * defaulting to procurement (PO/Invoice) wording everywhere.
 */
export function isProcurementMode(mode: ComparisonMode): boolean {
  return mode === "2-way" || mode === "3-way";
}

const MODE_LABELS: Record<ComparisonMode, string> = {
  "2-way": "2-Way Match",
  "3-way": "3-Way Match",
  universal: "Universal Comparison",
  contract: "Contract Comparison",
};

export function getModeLabel(mode: ComparisonMode): string {
  return MODE_LABELS[mode];
}

export interface FinancialsShape {
  totalExpected: number;
  totalInvoiced: number;
}

export function hasFinancialData(financials: FinancialsShape): boolean {
  return financials.totalExpected !== 0 || financials.totalInvoiced !== 0;
}
