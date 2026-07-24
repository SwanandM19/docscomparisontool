import type { ExtractedDocumentData, ExtractedLineItem } from "@/types/document";
import type {
  ComparisonMode,
  FieldDiff,
  LineItemDiff,
  Severity,
  ToleranceRuleInput,
} from "@/types/comparison";
import { findRule, isWithinTolerance, isDateWithinTolerance, percentVariance } from "./tolerance";
import { matchLineItems } from "./item-matching";
import { computeMatchScore } from "./scoring";

export interface ComparisonInputDoc {
  documentId: string;
  kind: "PO" | "GRN" | "Invoice" | "Contract";
  data: ExtractedDocumentData;
  confidence: number;
}

export interface EngineResult {
  fieldDiffs: FieldDiff[];
  lineItemDiffs: LineItemDiff[];
  missingItems: ExtractedLineItem[];
  extraItems: ExtractedLineItem[];
  score: ReturnType<typeof computeMatchScore>;
  financials: {
    totalExpected: number;
    totalInvoiced: number;
    netVariance: number;
    potentialSavings: number;
  };
}

function severityFor(kind: "identity" | "financial" | "date" | "tax", magnitude: number): Severity {
  if (kind === "identity") return "critical";
  if (kind === "date") return magnitude > 30 ? "high" : magnitude > 7 ? "medium" : "low";
  // financial / tax: magnitude is a percentage variance
  const abs = Math.abs(magnitude);
  if (abs > 15) return "critical";
  if (abs > 7) return "high";
  if (abs > 2) return "medium";
  return "low";
}

/**
 * Compares a single scalar field between two documents and returns a
 * FieldDiff, or null if both sides are missing (nothing to compare).
 */
function compareField(
  fieldName: string,
  valueA: string | null,
  valueB: string | null,
  opts: { critical?: boolean } = {}
): FieldDiff | null {
  if (valueA === null && valueB === null) return null;

  const normalizedA = valueA?.trim().toLowerCase() ?? null;
  const normalizedB = valueB?.trim().toLowerCase() ?? null;
  const matches = normalizedA === normalizedB;

  if (matches) {
    return {
      fieldName,
      docAValue: valueA,
      docBValue: valueB,
      severity: "low",
      differenceType: "value_mismatch",
      rootCause: `${fieldName} matches across documents.`,
      withinTolerance: true,
    };
  }

  const missing = valueA === null || valueB === null;
  return {
    fieldName,
    docAValue: valueA,
    docBValue: valueB,
    severity: missing ? "medium" : opts.critical ? "critical" : "high",
    differenceType: missing ? "missing_field" : "value_mismatch",
    rootCause: missing
      ? `${fieldName} is present on one document but missing on the other.`
      : `${fieldName} differs between documents ("${valueA}" vs "${valueB}").`,
    withinTolerance: false,
  };
}

function compareNumericField(
  fieldName: string,
  valueA: number | null,
  valueB: number | null,
  rules: ToleranceRuleInput[],
  ruleFieldName: string
): FieldDiff | null {
  if (valueA === null && valueB === null) return null;
  if (valueA === null || valueB === null) {
    return {
      fieldName,
      docAValue: valueA,
      docBValue: valueB,
      severity: "medium",
      differenceType: "missing_field",
      rootCause: `${fieldName} is missing from one of the documents.`,
      withinTolerance: false,
    };
  }

  const rule = findRule(rules, ruleFieldName);
  const within = isWithinTolerance(valueA, valueB, rule);
  const variance = percentVariance(valueA, valueB);

  return {
    fieldName,
    docAValue: valueA,
    docBValue: valueB,
    severity: within ? "low" : severityFor("financial", variance),
    differenceType: "value_mismatch",
    rootCause: within
      ? `${fieldName} is within the configured tolerance (${variance.toFixed(2)}% variance).`
      : `${fieldName} varies by ${variance.toFixed(2)}% (${valueA} vs ${valueB}), exceeding tolerance.`,
    withinTolerance: within,
  };
}

function compareDateField(
  fieldName: string,
  dateA: string | null,
  dateB: string | null,
  rules: ToleranceRuleInput[]
): FieldDiff | null {
  if (dateA === null && dateB === null) return null;
  const rule = findRule(rules, "Document Date");
  const within = isDateWithinTolerance(dateA, dateB, rule);

  const daysDiff =
    dateA && dateB
      ? Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

  return {
    fieldName,
    docAValue: dateA,
    docBValue: dateB,
    severity: within ? "low" : severityFor("date", daysDiff),
    differenceType: "date_mismatch",
    rootCause: within
      ? "Document dates fall within the acceptable window."
      : `Document dates differ by ${Math.round(daysDiff)} day(s), exceeding the configured tolerance.`,
    withinTolerance: within,
  };
}

/**
 * Builds a LineItemDiff for a matched pair of line items across up to three
 * documents (PO / GRN / Invoice roles). `roleA` is always treated as the
 * "expected/ordered" baseline; `roleB` as the "actual/billed" comparison
 * target; `roleGrn` is optional and only present for 3-way matches.
 */
function buildLineItemDiff(params: {
  index: number;
  itemA: ExtractedLineItem | null;
  itemB: ExtractedLineItem | null;
  itemGrn?: ExtractedLineItem | null;
  rules: ToleranceRuleInput[];
}): LineItemDiff {
  const { index, itemA, itemB, itemGrn, rules } = params;
  const description = itemA?.description ?? itemB?.description ?? itemGrn?.description ?? "Unknown item";
  const itemNo = itemA?.itemNo ?? itemB?.itemNo ?? itemGrn?.itemNo ?? String(index + 1).padStart(3, "0");

  const poQty = itemA?.quantity ?? null;
  const grnQty = itemGrn?.quantity ?? undefined;
  const invQty = itemB?.quantity ?? null;
  const poPrice = itemA?.unitPrice ?? null;
  const invPrice = itemB?.unitPrice ?? null;
  const poTotal = itemA?.total ?? (poQty !== null && poPrice !== null ? poQty * poPrice : null);
  const invTotal = itemB?.total ?? (invQty !== null && invPrice !== null ? invQty * invPrice : null);

  const qtyRule = findRule(rules, "Quantity");
  const priceRule = findRule(rules, "Unit Price");

  // Quantity variance: prefer GRN-vs-Invoice check (delivery vs billing) when
  // a GRN is present, since that's the more meaningful discrepancy for
  // 3-way matching; otherwise compare PO vs Invoice quantity directly.
  let qtyVariance = false;
  let qtyVarianceTag: string | undefined;
  let qtyExplanationParts: string[] = [];

  if (itemGrn && grnQty !== undefined && invQty !== null) {
    const grnVsInvOk = isWithinTolerance(grnQty, invQty, qtyRule);
    if (!grnVsInvOk) {
      qtyVariance = true;
      qtyVarianceTag = grnQty > invQty ? "[GRN Shortfall]" : "[Over-Invoiced Qty]";
      qtyExplanationParts.push(
        grnQty > invQty
          ? `Goods Receipt Note shows only ${grnQty} received, but vendor invoiced for ${invQty}. Potential overbilling of ${grnQty - invQty} unit(s).`
          : `Invoice bills for ${invQty} units, but only ${grnQty} were recorded as received per the GRN.`
      );
    }
    if (poQty !== null && !isWithinTolerance(poQty, grnQty, qtyRule)) {
      qtyVariance = true;
      qtyExplanationParts.push(
        `Quantity received (${grnQty}) differs from quantity ordered (${poQty}).`
      );
    }
  } else if (poQty !== null && invQty !== null) {
    const ok = isWithinTolerance(poQty, invQty, qtyRule);
    if (!ok) {
      qtyVariance = true;
      qtyVarianceTag = "[Quantity Mismatch]";
      qtyExplanationParts.push(
        invQty < poQty
          ? `Vendor invoiced for ${invQty} units, but PO requested ${poQty}. Short shipment.`
          : `Vendor invoiced for ${invQty} units, exceeding the ${poQty} units on the PO.`
      );
    }
  }

  let priceVariance = false;
  let priceVarianceTag: string | undefined;
  let priceExplanation: string | undefined;
  if (poPrice !== null && invPrice !== null) {
    const ok = isWithinTolerance(poPrice, invPrice, priceRule);
    if (!ok) {
      priceVariance = true;
      priceVarianceTag = "[Price Variance]";
      const variancePct = percentVariance(poPrice, invPrice);
      priceExplanation = `Invoiced price ($${invPrice.toFixed(2)}) ${
        invPrice > poPrice ? "exceeds" : "is below"
      } PO contract rate ($${poPrice.toFixed(2)}) by $${Math.abs(invPrice - poPrice).toFixed(2)} per unit (${Math.abs(
        variancePct
      ).toFixed(1)}% variance).`;
    }
  }

  const explanation =
    [...qtyExplanationParts, priceExplanation].filter(Boolean).join(" ") ||
    `Item quantities and prices perfectly match across all provided documents.`;

  const severity: Severity =
    qtyVarianceTag === "[GRN Shortfall]" || (priceVariance && Math.abs(percentVariance(poPrice ?? 0, invPrice ?? 0)) > 15)
      ? "critical"
      : qtyVariance || priceVariance
      ? "medium"
      : "low";

  return {
    id: String(index + 1),
    itemNo,
    description,
    poQty,
    grnQty,
    invQty,
    poPrice,
    invPrice,
    poTotal,
    invTotal,
    qtyVariance,
    priceVariance,
    qtyVarianceTag,
    priceVarianceTag,
    explanation,
    severity,
  };
}

/**
 * Main entry point: runs a full deterministic comparison across 2 or 3
 * documents. `docs` must be ordered as [primary, secondary] for 2-way/
 * universal/contract modes, or [PO, GRN, Invoice] for 3-way mode.
 */
export function runComparison(
  mode: ComparisonMode,
  docs: ComparisonInputDoc[],
  toleranceRules: ToleranceRuleInput[]
): EngineResult {
  if (mode === "3-way") {
    return runThreeWay(docs, toleranceRules);
  }
  return runTwoWay(docs, toleranceRules);
}

function runTwoWay(docs: ComparisonInputDoc[], rules: ToleranceRuleInput[]): EngineResult {
  const [docA, docB] = docs;
  const a = docA.data;
  const b = docB.data;

  const fieldDiffs: FieldDiff[] = [];
  const pushIf = (diff: FieldDiff | null) => {
    if (diff) fieldDiffs.push(diff);
  };

  pushIf(compareField("Vendor Name", a.vendorName, b.vendorName, { critical: true }));
  pushIf(compareField("Vendor GSTIN", a.vendorGSTIN, b.vendorGSTIN, { critical: true }));
  pushIf(compareField(`${docA.kind} Number`, a.poNumber, b.poNumber));
  pushIf(compareField("Invoice Number", a.invoiceNumber, b.invoiceNumber));
  if (a.grnNumber || b.grnNumber) pushIf(compareField("GRN Number", a.grnNumber, b.grnNumber));
  pushIf(compareField("Currency", a.currency, b.currency, { critical: true }));
  pushIf(compareDateField("Document Date", a.documentDate, b.documentDate, rules));
  pushIf(compareNumericField("Total Amount", a.totalAmount, b.totalAmount, rules, "Total Amount"));

  const taxA = a.taxDetails.reduce((s, t) => s + t.amount, 0);
  const taxB = b.taxDetails.reduce((s, t) => s + t.amount, 0);
  if (a.taxDetails.length || b.taxDetails.length) {
    pushIf(compareNumericField("Tax Amount", taxA, taxB, rules, "Tax Amount"));
  }

  const { matched, onlyInA, onlyInB } = matchLineItems(a.lineItems, b.lineItems);

  const lineItemDiffs: LineItemDiff[] = matched.map((pair, idx) =>
    buildLineItemDiff({ index: idx, itemA: pair.itemA, itemB: pair.itemB, rules })
  );

  // Missing items (in A, not in B) and extra items (in B, not in A) each get
  // their own field-diff entry so they surface in the difference engine too.
  onlyInA.forEach((item) => {
    fieldDiffs.push({
      fieldName: `Line Item: ${item.description}`,
      docAValue: item.quantity,
      docBValue: null,
      severity: "high",
      differenceType: "missing_item",
      rootCause: `"${item.description}" appears on ${docA.kind} but is missing from ${docB.kind}.`,
      withinTolerance: false,
    });
  });
  onlyInB.forEach((item) => {
    fieldDiffs.push({
      fieldName: `Line Item: ${item.description}`,
      docAValue: null,
      docBValue: item.quantity,
      severity: "high",
      differenceType: "extra_item",
      rootCause: `"${item.description}" appears on ${docB.kind} but was not present on ${docA.kind}.`,
      withinTolerance: false,
    });
  });

  const score = computeMatchScore(
    fieldDiffs,
    lineItemDiffs,
    [docA.confidence, docB.confidence],
    onlyInA.length,
    onlyInB.length
  );

  const totalExpected = a.lineItems.reduce((s, i) => s + i.total, 0) || a.totalAmount || 0;
  const totalInvoiced = b.lineItems.reduce((s, i) => s + i.total, 0) || b.totalAmount || 0;
  const netVariance = totalInvoiced - totalExpected;
  const potentialSavings = lineItemDiffs.reduce((sum, item) => {
    let itemSavings = 0;
    if (item.priceVariance && item.poPrice !== null && item.invPrice !== null && item.invQty) {
      itemSavings += Math.max(0, (item.invPrice - item.poPrice) * item.invQty);
    }
    if (item.qtyVarianceTag === "[GRN Shortfall]" && item.grnQty != null && item.invQty != null && item.invPrice != null) {
      itemSavings += Math.max(0, (item.invQty - item.grnQty) * item.invPrice);
    }
    return sum + itemSavings;
  }, 0);

  return {
    fieldDiffs,
    lineItemDiffs,
    missingItems: onlyInA,
    extraItems: onlyInB,
    score,
    financials: {
      totalExpected: round2(totalExpected),
      totalInvoiced: round2(totalInvoiced),
      netVariance: round2(netVariance),
      potentialSavings: round2(potentialSavings),
    },
  };
}

function runThreeWay(docs: ComparisonInputDoc[], rules: ToleranceRuleInput[]): EngineResult {
  const po = docs.find((d) => d.kind === "PO") ?? docs[0];
  const grn = docs.find((d) => d.kind === "GRN") ?? docs[1];
  const inv = docs.find((d) => d.kind === "Invoice") ?? docs[2];

  const a = po.data;
  const g = grn.data;
  const b = inv.data;

  const fieldDiffs: FieldDiff[] = [];
  const pushIf = (diff: FieldDiff | null) => {
    if (diff) fieldDiffs.push(diff);
  };

  pushIf(compareField("Vendor Name", a.vendorName, b.vendorName, { critical: true }));
  pushIf(compareField("Vendor GSTIN", a.vendorGSTIN, b.vendorGSTIN, { critical: true }));
  pushIf(compareField("PO Number", a.poNumber, b.poNumber));
  pushIf(compareField("GRN Number", g.grnNumber, g.grnNumber ? g.grnNumber : null));
  pushIf(compareField("Invoice Number", a.invoiceNumber, b.invoiceNumber));
  pushIf(compareField("Currency", a.currency, b.currency, { critical: true }));
  pushIf(compareDateField("PO vs Invoice Date", a.documentDate, b.documentDate, rules));
  pushIf(compareDateField("GRN vs Invoice Date", g.documentDate, b.documentDate, rules));
  pushIf(compareNumericField("Total Amount", a.totalAmount, b.totalAmount, rules, "Total Amount"));

  const taxA = a.taxDetails.reduce((s, t) => s + t.amount, 0);
  const taxB = b.taxDetails.reduce((s, t) => s + t.amount, 0);
  if (a.taxDetails.length || b.taxDetails.length) {
    pushIf(compareNumericField("Tax Amount", taxA, taxB, rules, "Tax Amount"));
  }

  // Match PO items to Invoice items first (establishes the canonical item
  // set), then align GRN items onto the same set by best match.
  const { matched, onlyInA, onlyInB } = matchLineItems(a.lineItems, b.lineItems);
  const { matched: grnMatchToPo } = matchLineItems(a.lineItems, g.lineItems);
  const grnByPoDescription = new Map(
    grnMatchToPo.map((m) => [normalizeKey(m.itemA), m.itemB])
  );

  const lineItemDiffs: LineItemDiff[] = matched.map((pair, idx) => {
    const grnItem = grnByPoDescription.get(normalizeKey(pair.itemA)) ?? null;
    return buildLineItemDiff({ index: idx, itemA: pair.itemA, itemB: pair.itemB, itemGrn: grnItem, rules });
  });

  onlyInA.forEach((item) => {
    fieldDiffs.push({
      fieldName: `Line Item: ${item.description}`,
      docAValue: item.quantity,
      docBValue: null,
      severity: "high",
      differenceType: "missing_item",
      rootCause: `"${item.description}" appears on PO but is missing from Invoice.`,
      withinTolerance: false,
    });
  });
  onlyInB.forEach((item) => {
    fieldDiffs.push({
      fieldName: `Line Item: ${item.description}`,
      docAValue: null,
      docBValue: item.quantity,
      severity: "high",
      differenceType: "extra_item",
      rootCause: `"${item.description}" appears on Invoice but was not present on PO.`,
      withinTolerance: false,
    });
  });

  const score = computeMatchScore(
    fieldDiffs,
    lineItemDiffs,
    [po.confidence, grn.confidence, inv.confidence],
    onlyInA.length,
    onlyInB.length
  );

  const totalExpected = a.lineItems.reduce((s, i) => s + i.total, 0) || a.totalAmount || 0;
  const totalInvoiced = b.lineItems.reduce((s, i) => s + i.total, 0) || b.totalAmount || 0;
  const netVariance = totalInvoiced - totalExpected;
  const potentialSavings = lineItemDiffs.reduce((sum, item) => {
    let itemSavings = 0;
    if (item.priceVariance && item.poPrice !== null && item.invPrice !== null && item.invQty) {
      itemSavings += Math.max(0, (item.invPrice - item.poPrice) * item.invQty);
    }
    if (item.qtyVarianceTag === "[GRN Shortfall]" && item.grnQty != null && item.invQty != null && item.invPrice != null) {
      itemSavings += Math.max(0, (item.invQty - item.grnQty) * item.invPrice);
    }
    return sum + itemSavings;
  }, 0);

  return {
    fieldDiffs,
    lineItemDiffs,
    missingItems: onlyInA,
    extraItems: onlyInB,
    score,
    financials: {
      totalExpected: round2(totalExpected),
      totalInvoiced: round2(totalInvoiced),
      netVariance: round2(netVariance),
      potentialSavings: round2(potentialSavings),
    },
  };
}

function normalizeKey(item: ExtractedLineItem): string {
  return (item.itemNo ?? item.description).trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
