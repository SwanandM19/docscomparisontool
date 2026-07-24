import type { ToleranceRuleInput } from "@/types/comparison";

export function findRule(
  rules: ToleranceRuleInput[],
  field: string
): ToleranceRuleInput | undefined {
  return rules.find((r) => r.field.toLowerCase() === field.toLowerCase() && r.enabled);
}

/**
 * Returns true if `actual` is within tolerance of `expected` given a rule.
 * If no rule is found/enabled for the field, any non-zero difference counts
 * as a variance (strict comparison).
 */
export function isWithinTolerance(
  expected: number,
  actual: number,
  rule: ToleranceRuleInput | undefined
): boolean {
  const diff = Math.abs(actual - expected);
  if (diff === 0) return true;
  if (!rule) return false;

  if (rule.type === "percentage") {
    if (expected === 0) return diff === 0;
    const pctDiff = (diff / Math.abs(expected)) * 100;
    return pctDiff <= rule.value;
  }

  // absolute
  return diff <= rule.value;
}

export function percentVariance(expected: number, actual: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return ((actual - expected) / Math.abs(expected)) * 100;
}

/**
 * Compares two ISO date strings and returns whether they're within the
 * tolerance rule's day threshold.
 */
export function isDateWithinTolerance(
  dateA: string | null,
  dateB: string | null,
  rule: ToleranceRuleInput | undefined
): boolean {
  if (!dateA || !dateB) return dateA === dateB;
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return dateA === dateB;

  const diffDays = Math.abs(a - b) / (1000 * 60 * 60 * 24);
  if (!rule) return diffDays === 0;
  return diffDays <= rule.value;
}
