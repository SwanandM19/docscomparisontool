"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Download,
  ArrowLeft,
  Building2,
  Calendar,
  Calculator,
  ShieldCheck,
  Loader2,
  RefreshCcw,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getComparison,
  generateSummary,
  generateRecommendation,
  exportComparisonPdf,
  summarizeDocument,
  ApiClientError,
  type ComparisonDetailResponse,
} from "@/lib/api-client";
import { isProcurementMode, getModeLabel, hasFinancialData } from "@/lib/comparison/mode-labels";

const SUMMARY_RECOMMENDATIONS = [
  "Recommended for Approval",
  "Requires Manual Review",
  "High Risk – Do Not Approve",
  "High Risk - Do Not Approve", // tolerate a plain hyphen in case the model doesn't use an en dash
] as const;

interface ParsedSummary {
  intro: string[];
  bullets: string[];
  recommendation: string | null;
}

/**
 * Splits the AI-generated executive summary (lead-in sentences + "- " bullet
 * lines + a final verbatim recommendation line, per the prompt in
 * lib/ai/summary.ts) into renderable parts. Falls back gracefully — any line
 * that isn't a bullet or the recommendation is treated as lead-in prose, so
 * older/malformed summaries still render as plain text instead of breaking.
 */
function parseSummary(text: string): ParsedSummary {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let recommendation: string | null = null;
  const last = lines[lines.length - 1];
  if (last && SUMMARY_RECOMMENDATIONS.some((r) => r.toLowerCase() === last.toLowerCase())) {
    recommendation = lines.pop()!;
  }

  const intro: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    if (/^[-•*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-•*]\s+/, ""));
    } else {
      intro.push(line);
    }
  }

  return { intro, bullets, recommendation };
}

function recommendationStyle(recommendation: string) {
  if (recommendation.startsWith("Recommended")) return "bg-success/10 text-success border-success/20";
  if (recommendation.startsWith("Requires")) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

interface ComparisonResultsProps {
  comparisonId: string;
  onBack: () => void;
  onOpenWorkspace?: () => void;
}

export default function ComparisonResults({
  comparisonId,
  onBack,
  onOpenWorkspace,
}: ComparisonResultsProps) {
  const [comparison, setComparison] = useState<ComparisonDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const [expandedLineItemId, setExpandedLineItemId] = useState<string | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  // Per-document plain-language summaries. Keyed by document _id; generated
  // lazily once the comparison loads.
  const [docSummaries, setDocSummaries] = useState<
    Record<string, { text: string | null; loading: boolean; error: string | null }>
  >({});

  const runDocSummary = useCallback((docId: string, refresh = false) => {
    setDocSummaries((prev) => ({
      ...prev,
      [docId]: { text: prev[docId]?.text ?? null, loading: true, error: null },
    }));
    summarizeDocument(docId, refresh)
      .then(({ aiSummary }) =>
        setDocSummaries((prev) => ({
          ...prev,
          [docId]: { text: aiSummary, loading: false, error: null },
        })),
      )
      .catch((err) =>
        setDocSummaries((prev) => ({
          ...prev,
          [docId]: {
            text: prev[docId]?.text ?? null,
            loading: false,
            error:
              err instanceof ApiClientError ? err.message : "Could not generate summary.",
          },
        })),
      );
  }, []);

  const loadComparison = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getComparison(comparisonId);
      setComparison(data);
    } catch (err) {
      setLoadError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load comparison.",
      );
    } finally {
      setLoading(false);
    }
  }, [comparisonId]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  // Kick off AI summary + recommendation generation once the comparison is
  // loaded, if they haven't been generated yet.
  useEffect(() => {
    if (!comparison) return;

    if (!comparison.aiSummary && !summaryLoading) {
      setSummaryLoading(true);
      generateSummary(comparison._id)
        .then(({ aiSummary }) =>
          setComparison((prev) => (prev ? { ...prev, aiSummary } : prev)),
        )
        .catch(() => void 0)
        .finally(() => setSummaryLoading(false));
    }

    if (!comparison.aiRecommendation && !recommendationLoading) {
      setRecommendationLoading(true);
      generateRecommendation(comparison._id)
        .then(({ aiRecommendation }) =>
          setComparison((prev) =>
            prev ? { ...prev, aiRecommendation } : prev,
          ),
        )
        .catch(() => void 0)
        .finally(() => setRecommendationLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison?._id]);

  // Seed / generate per-document summaries once the comparison is loaded.
  useEffect(() => {
    if (!comparison) return;
    const seeded: typeof docSummaries = {};
    for (const doc of comparison.documents) {
      if (doc.aiSummary) {
        seeded[doc._id] = { text: doc.aiSummary, loading: false, error: null };
      } else {
        seeded[doc._id] = { text: null, loading: true, error: null };
        runDocSummary(doc._id);
      }
    }
    setDocSummaries(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison?._id]);

  const handleExport = async () => {
    if (!comparison) return;
    setIsExporting(true);
    setExportError(null);
    setExportComplete(false);
    try {
      const blob = await exportComparisonPdf(comparison._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparison-${comparison._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    } catch (err) {
      setExportError(
        err instanceof ApiClientError ? err.message : "Export failed.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-sm text-muted-foreground">
          Loading comparison results…
        </p>
      </div>
    );
  }

  if (loadError || !comparison) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive font-medium">
          {loadError ?? "Comparison not found."}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadComparison}
            className="gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to Ingestion
          </Button>
        </div>
      </div>
    );
  }

  const hasGrn = comparison.mode === "3-way";
  const procurementMode = isProcurementMode(comparison.mode);
  const showFinancials = procurementMode || hasFinancialData(comparison.financials);
  const { financials, score, lineItemDiffs, fieldDiffs } = comparison;

  const vendorDiff = fieldDiffs.find((f) => f.fieldName === "Vendor Name");
  const vendorName =
    (vendorDiff?.docAValue as string) ||
    (vendorDiff?.docBValue as string) ||
    null;
  const primaryDoc = comparison.documents[0];
  const documentLabel = procurementMode
    ? vendorName ?? "Unknown Vendor"
    : comparison.mode === "contract"
      ? "Contract Comparison"
      : "Document Comparison";
  const documentSubLabel = primaryDoc?.extractedData?.vendorGSTIN
    ? `GSTIN: ${primaryDoc.extractedData.vendorGSTIN}`
    : comparison.documents.map((d) => d.fileName).join(" vs ") ||
      `${comparison.documents.length} documents matched`;
  const createdDate = new Date(comparison.createdAt).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  let statusColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
  if (score.status === "Failed")
    statusColor =
      "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400";
  else if (score.status === "Partial")
    statusColor = "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400";

  const matchStatusLabel =
    score.status === "Matched"
      ? "Perfect Match"
      : score.status === "Partial"
        ? "Variance Detected"
        : "Critical Mismatch";

  const recommendationColor =
    comparison.aiRecommendation?.decision === "Approve"
      ? "text-success"
      : comparison.aiRecommendation?.decision === "Hold"
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="stagger-children max-w-[1440px] mx-auto space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Ingestion
        </button>
        <div className="flex items-center gap-2">
          {onOpenWorkspace && (
            <Button
              onClick={onOpenWorkspace}
              size="sm"
              className="text-xs h-8 gap-1.5 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-lg shadow-sm cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open AI Workspace
            </Button>
          )}
          <Badge
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold border-0",
              statusColor,
            )}
          >
            {matchStatusLabel}
          </Badge>
          <Badge
            variant="secondary"
            className="text-xs px-3 py-1 bg-brand/10 text-brand border-0"
          >
            {getModeLabel(comparison.mode)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Data Tables & Structured Diff */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{documentLabel}</h3>
                    <p className="text-xs text-muted-foreground">
                      {documentSubLabel}
                    </p>
                  </div>
                </div>
                <div className={cn("grid gap-x-8 gap-y-2 text-xs border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6", showFinancials ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1")}>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">
                      Date Processed
                    </span>
                    <span className="font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {createdDate}
                    </span>
                  </div>
                  {showFinancials && (
                    <>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">
                          Expected Total
                        </span>
                        <span className="font-semibold">
                          ₹{financials.totalExpected.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">
                          Invoiced Total
                        </span>
                        <span className="font-semibold">
                          ₹{financials.totalInvoiced.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-document plain-language summaries */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 py-4 px-6">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand" />
                Document Summaries
              </CardTitle>
              <CardDescription className="text-xs">
                Plain-language overview of each uploaded document
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {comparison.documents.map((doc) => {
                const s = docSummaries[doc._id];
                return (
                  <div
                    key={doc._id}
                    className="rounded-lg border border-border/50 bg-secondary/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono shrink-0"
                        >
                          {doc.kind}
                        </Badge>
                        <span className="text-xs font-medium truncate">
                          {doc.fileName}
                        </span>
                      </div>
                      {s && !s.loading && (
                        <button
                          onClick={() => runDocSummary(doc._id, true)}
                          className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
                          title="Regenerate summary"
                        >
                          <RefreshCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {s?.loading ? (
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating summary…
                      </p>
                    ) : s?.error ? (
                      <p className="text-xs text-destructive">{s.error}</p>
                    ) : s?.text ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {s.text}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">
                        No summary available.
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Interactive Structured Diff Table — hidden entirely for
              non-procurement modes with no line items, rather than showing
              an empty PO/Invoice-shaped table for a document type that was
              never going to have line items in the first place. */}
          {(procurementMode || lineItemDiffs.length > 0) && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 py-4 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {procurementMode ? "Structured Line-Item Diff" : "Structured Field Diff"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Click a mismatched row to view detailed root-cause analysis
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-mono px-2 py-0.5"
                >
                  Line Items: {lineItemDiffs.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {/* <Table> */}
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/50 bg-secondary/20">
                      <TableHead className="w-[50px] text-center text-xs font-semibold">
                        LN
                      </TableHead>
                      <TableHead className="w-[32%] text-xs font-semibold">
                        {procurementMode ? "Item Description" : "Description"}
                      </TableHead>
                      <TableHead className="w-[16%] text-xs font-semibold text-center">
                        {procurementMode ? (hasGrn ? "PO / GRN / INV Qty" : "PO vs INV Qty") : "Doc A vs Doc B Qty"}
                      </TableHead>
                      <TableHead className="w-[13%] text-xs font-semibold text-right">
                        {procurementMode ? "PO Price" : "Doc A Value"}
                      </TableHead>
                      <TableHead className="w-[13%] text-xs font-semibold text-right">
                        {procurementMode ? "INV Price" : "Doc B Value"}
                      </TableHead>
                      <TableHead className="w-[13%] text-xs font-semibold text-right">
                        {procurementMode ? "PO Total" : "Total (Doc A)"}
                      </TableHead>
                      <TableHead className="w-[13%] text-xs font-semibold text-right">
                        {procurementMode ? "INV Total" : "Total (Doc B)"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItemDiffs.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-10 text-sm text-muted-foreground"
                        >
                          No matched line items were found between the compared
                          documents.
                        </TableCell>
                      </TableRow>
                    )}
                    {lineItemDiffs.map((item) => {
                      const isMismatched =
                        item.qtyVariance || item.priceVariance;
                      const isExpanded = expandedLineItemId === item.id;

                      return (
                        <React.Fragment key={item.id}>
                          <TableRow
                            onClick={() =>
                              isMismatched &&
                              setExpandedLineItemId(isExpanded ? null : item.id)
                            }
                            className={cn(
                              "transition-all border-b border-border/40",
                              isMismatched ? "cursor-pointer" : "",
                              isMismatched
                                ? isExpanded
                                  ? "bg-destructive/[0.06]"
                                  : "bg-destructive/[0.02] hover:bg-destructive/[0.04]"
                                : "hover:bg-secondary/40",
                            )}
                          >
                            <TableCell className="text-center font-mono text-xs font-medium text-muted-foreground py-4 align-top">
                              {item.itemNo}
                            </TableCell>
                            <TableCell className="font-medium text-sm py-4 align-top break-words whitespace-normal pr-2">
                              <div>
                                <span className="text-foreground leading-snug block">
                                  {item.description}
                                </span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {item.qtyVariance && item.qtyVarianceTag && (
                                    <Badge className="bg-destructive/10 text-destructive border-0 text-[9px] font-bold py-0 px-1.5 leading-none">
                                      {item.qtyVarianceTag}
                                    </Badge>
                                  )}
                                  {item.priceVariance &&
                                    item.priceVarianceTag && (
                                      <Badge className="bg-warning/10 text-warning border-0 text-[9px] font-bold py-0 px-1.5 leading-none">
                                        {item.priceVarianceTag}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <div className="inline-flex items-center gap-1.5 text-xs font-mono">
                                <span
                                  className={cn(
                                    item.qtyVariance &&
                                      "text-destructive font-bold",
                                  )}
                                >
                                  {item.poQty ?? "—"}
                                </span>
                                {hasGrn && (
                                  <>
                                    <span className="text-muted-foreground/30">
                                      /
                                    </span>
                                    <span
                                      className={cn(
                                        item.qtyVarianceTag ===
                                          "[GRN Shortfall]" &&
                                          "text-destructive font-bold",
                                      )}
                                    >
                                      {item.grnQty ?? "—"}
                                    </span>
                                  </>
                                )}
                                <span className="text-muted-foreground/30">
                                  /
                                </span>
                                <span
                                  className={cn(
                                    item.qtyVariance &&
                                      "text-destructive font-bold",
                                  )}
                                >
                                  {item.invQty ?? "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-4 font-mono text-xs">
                              {item.poPrice != null
                                ? `₹${item.poPrice.toFixed(2)}`
                                : "—"}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right py-4 font-mono text-xs",
                                item.priceVariance &&
                                  "text-destructive font-bold",
                              )}
                            >
                              {item.invPrice != null
                                ? `₹${item.invPrice.toFixed(2)}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right py-4 font-mono text-xs">
                              {item.poTotal != null
                                ? `₹${item.poTotal.toFixed(2)}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right py-4 font-mono text-xs font-semibold">
                              {item.invTotal != null
                                ? `₹${item.invTotal.toFixed(2)}`
                                : "—"}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="border-b border-border/40 bg-secondary/20 hover:bg-secondary/20">
                              <TableCell colSpan={7} className="py-3 px-6">
                                <div className="flex items-start gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                                  <div className="space-y-0.5">
                                    <span className="text-xs font-bold block">
                                      Root-Cause Explanation
                                    </span>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                      {item.explanation}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Field-level diffs (vendor, dates, totals, tax, etc.) */}
          {fieldDiffs.some((f) => !f.withinTolerance) && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/50 py-4 px-6">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  Document-Level Discrepancies
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {fieldDiffs
                  .filter((f) => !f.withinTolerance)
                  .map((diff, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40"
                    >
                      <Badge
                        className={cn(
                          "text-[9px] font-bold uppercase shrink-0 mt-0.5 border-0",
                          diff.severity === "critical"
                            ? "bg-destructive/15 text-destructive"
                            : diff.severity === "high"
                              ? "bg-destructive/10 text-destructive"
                              : diff.severity === "medium"
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground",
                        )}
                      >
                        {diff.severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {diff.fieldName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {diff.rootCause}
                        </p>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky AI & Financial Summary */}
        <div className="space-y-6 lg:sticky lg:top-20">
          {/* Financial Impact Calculator Card — the financial breakdown only
              renders when there's actually financial data; the score
              metrics below it are always relevant regardless of mode. */}
          <Card className="border-border/80 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand to-violet-500" />
            <CardHeader className="py-4 px-6 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-brand" />
                {showFinancials ? "Financial Impact Calculator" : "Comparison Metrics"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {showFinancials && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/40 p-3 rounded-lg border border-border/30">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                        Expected Total
                      </span>
                      <span className="text-lg font-bold tracking-tight text-foreground font-mono block mt-1">
                        ₹{financials.totalExpected.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-secondary/40 p-3 rounded-lg border border-border/30">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                        Total Invoiced
                      </span>
                      <span className="text-lg font-bold tracking-tight text-foreground font-mono block mt-1">
                        ₹{financials.totalInvoiced.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border/60 bg-secondary/10 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Net Variance
                      </span>
                      <span
                        className={cn(
                          "text-base font-bold font-mono",
                          financials.netVariance > 0
                            ? "text-destructive"
                            : financials.netVariance < 0
                              ? "text-success"
                              : "text-foreground",
                        )}
                      >
                        {financials.netVariance > 0
                          ? `+₹${financials.netVariance.toFixed(2)}`
                          : financials.netVariance < 0
                            ? `-₹${Math.abs(financials.netVariance).toFixed(2)}`
                            : "₹0.00"}
                      </span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-success" />
                        Potential Savings Identified
                      </span>
                      <span className="text-base font-bold font-mono text-success">
                        ₹{financials.potentialSavings.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div>
                  <p className="text-lg font-bold text-brand">
                    {score.matchScore}%
                  </p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                    Match Score
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-brand">
                    {score.lineItemAccuracy}%
                  </p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                    Line Accuracy
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-brand">
                    {score.confidenceScore}%
                  </p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                    AI Confidence
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary Card */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="py-4 px-6 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles
                  className={cn(
                    "w-4 h-4 text-brand",
                    summaryLoading && "animate-pulse",
                  )}
                />
                Executive AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="text-xs leading-relaxed text-muted-foreground min-h-[3rem]">
                {summaryLoading && !comparison.aiSummary ? (
                  <div className="flex items-center gap-2 text-muted-foreground/70">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating executive summary…
                  </div>
                ) : comparison.aiSummary ? (
                  (() => {
                    const { intro, bullets, recommendation } = parseSummary(comparison.aiSummary);
                    return (
                      <div className="space-y-3">
                        {intro.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                        {bullets.length > 0 && (
                          <ul className="space-y-1.5 list-disc pl-4 marker:text-brand">
                            {bullets.map((bullet, i) => (
                              <li key={i}>{bullet}</li>
                            ))}
                          </ul>
                        )}
                        {recommendation && (
                          <Badge
                            className={cn(
                              "text-[10px] font-semibold border px-2.5 py-1 mt-1",
                              recommendationStyle(recommendation)
                            )}
                          >
                            {recommendation}
                          </Badge>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p>Summary unavailable.</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">
                    AI Recommendation
                  </span>
                  {comparison.aiRecommendation ? (
                    <span
                      className={cn("text-xs font-bold", recommendationColor)}
                    >
                      {comparison.aiRecommendation.decision}
                    </span>
                  ) : recommendationLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      comparison.aiRecommendation?.decision === "Approve"
                        ? "bg-success"
                        : comparison.aiRecommendation?.decision === "Hold"
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                    style={{ width: `${score.matchScore}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed">
                  {comparison.aiRecommendation?.reason ??
                    (recommendationLoading
                      ? "Analyzing discrepancies…"
                      : "No recommendation available.")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Export Report Action */}
          <div className="space-y-2">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full h-11 bg-brand text-brand-foreground hover:bg-brand/90 transition-all font-semibold rounded-xl text-xs gap-2 flex items-center justify-center shadow-lg glow-brand hover:scale-[1.01] active:scale-[0.99]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Compiling Report...
                </>
              ) : exportComplete ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Report Downloaded
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Audit Report
                </>
              )}
            </Button>
            {exportError && (
              <p className="text-[11px] text-destructive text-center">
                {exportError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
