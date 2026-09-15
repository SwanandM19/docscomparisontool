"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileType2,
  Image as ImageIcon,
  ArrowLeftRight,
  Sparkles,
  CheckCircle2,
  Shield,
  X,
  Brain,
  ScanSearch,
  DatabaseZap,
  Receipt,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
  RefreshCcw,
  Loader2,
  GraduationCap,
  UserSquare2,
  FileSignature,
  Handshake,
  Tag,
  Landmark,
  ReceiptText,
  BookOpenCheck,
  ShieldCheck,
  Mail,
  FileCheck2,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDocumentPipeline, type PipelineState } from "@/lib/hooks/use-document-pipeline";
import { runCompare, ApiClientError } from "@/lib/api-client";
import type { DocumentKind } from "@/types/document";
import type { ComparisonMode } from "@/types/comparison";

/* ─────────────────────── Types ─────────────────────── */

type SlotKey = "po" | "invoice";

/* ─────────────── Slot Configuration ────────────────── */

interface SlotConfig {
  key: SlotKey;
  kind: DocumentKind;
  label: string;
  shortLabel: string;
  subLabel: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  required: boolean;
  accept: string;
}

/**
 * "po" and "invoice" slot labels are procurement-specific by default; when
 * the user picks a non-procurement preset (Universal / Contract / JD vs
 * Resume), the slot copy is swapped to something that doesn't imply a
 * PO/Invoice pairing. The underlying document `kind` sent to the backend
 * stays "PO"/"Invoice" either way — see slotConfigs below — since the
 * extraction + comparison engine only needs a generic two-document shape,
 * not the specific procurement labels.
 */
function getSlotConfig(key: SlotKey, preset: string): SlotConfig {
  const base = slotConfigs[key];

  if (preset === "universal") {
    return key === "po"
      ? { ...base, label: "Document A · First File", shortLabel: "DOC A", subLabel: "Upload primary document" }
      : { ...base, label: "Document B · Second File", shortLabel: "DOC B", subLabel: "Upload comparison document" };
  }

  if (preset === "contract") {
    return key === "po"
      ? { ...base, label: "Document A · Base Contract", shortLabel: "BASE", subLabel: "Upload base contract or draft" }
      : { ...base, label: "Document B · Revised Contract", shortLabel: "REV", subLabel: "Upload revised contract or redline" };
  }

  if (preset === "jd-resume") {
    return key === "po"
      ? { ...base, label: "Document A · Job Description", shortLabel: "JD", subLabel: "Upload Job Description", icon: GraduationCap }
      : { ...base, label: "Document B · Resume", shortLabel: "RESUME", subLabel: "Upload Candidate Resume", icon: UserSquare2 };
  }

  if (preset === "contract-agreement") {
    return key === "po"
      ? { ...base, label: "Document A · Contract", shortLabel: "CONTRACT", subLabel: "Upload Contract", icon: FileSignature }
      : { ...base, label: "Document B · Agreement", shortLabel: "AGREEMENT", subLabel: "Upload Agreement", icon: Handshake };
  }

  if (preset === "quotation-po") {
    return key === "po"
      ? { ...base, label: "Document A · Quotation", shortLabel: "QUOTE", subLabel: "Upload Quotation", icon: Tag }
      : { ...base, label: "Document B · Purchase Order", shortLabel: "PO", subLabel: "Upload Purchase Order", icon: ClipboardList };
  }

  if (preset === "bank-statement") {
    return key === "po"
      ? { ...base, label: "Document A · Bank Statement", shortLabel: "STATEMENT", subLabel: "Upload Bank Statement", icon: Landmark }
      : { ...base, label: "Document B · Transaction Report", shortLabel: "TXN REPORT", subLabel: "Upload Transaction Report", icon: ReceiptText };
  }

  if (preset === "policy-compliance") {
    return key === "po"
      ? { ...base, label: "Document A · Policy", shortLabel: "POLICY", subLabel: "Upload Policy Document", icon: BookOpenCheck }
      : { ...base, label: "Document B · Compliance Document", shortLabel: "COMPLIANCE", subLabel: "Upload Compliance Document", icon: ShieldCheck };
  }

  if (preset === "offer-employment") {
    return key === "po"
      ? { ...base, label: "Document A · Offer Letter", shortLabel: "OFFER", subLabel: "Upload Offer Letter", icon: Mail }
      : { ...base, label: "Document B · Employment Contract", shortLabel: "CONTRACT", subLabel: "Upload Employment Contract", icon: FileCheck2 };
  }

  if (preset === "delivery-invoice") {
    return key === "po"
      ? { ...base, label: "Document A · Delivery Note", shortLabel: "DELIVERY", subLabel: "Upload Delivery Note", icon: Truck }
      : { ...base, label: "Document B · Invoice", shortLabel: "INV", subLabel: "Upload Vendor Invoice", icon: Receipt };
  }

  return base;
}

/* ─────────────── Comparison Type Cards ──────────────── */

interface ComparisonTypeConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

/**
 * Presented as the primary "what do you want to compare?" chooser. Every
 * card routes through the exact same upload + /api/compare pipeline below —
 * `id` here is just the `preset` value, which only changes slot labels and
 * the comparison `mode` passed to the existing backend (see handleRunMatch).
 */
const COMPARISON_TYPES: ComparisonTypeConfig[] = [
  {
    id: "po-invoice",
    title: "Purchase Order vs Invoice",
    description: "2-way procurement match with line-item, tax, and tolerance-aware field diffing.",
    icon: FileText,
    iconColor: "text-brand",
    iconBg: "bg-brand/10",
  },
  {
    id: "jd-resume",
    title: "Job Description vs Resume",
    description: "Line up a candidate's resume against a job description to see how well it fits.",
    icon: GraduationCap,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
  },
  {
    id: "contract",
    title: "Contract Clause Matcher",
    description: "Compare a base contract against a revised draft or redline.",
    icon: Shield,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  {
    id: "contract-agreement",
    title: "Contract vs Agreement",
    description: "Compare a contract against a related agreement to spot mismatched terms.",
    icon: FileSignature,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-500/10",
  },
  {
    id: "quotation-po",
    title: "Quotation vs Purchase Order",
    description: "Check a vendor quotation against the purchase order raised from it.",
    icon: Tag,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
  {
    id: "bank-statement",
    title: "Bank Statement vs Transaction Report",
    description: "Reconcile a bank statement against an internal transaction report.",
    icon: Landmark,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-500/10",
  },
  {
    id: "policy-compliance",
    title: "Policy vs Compliance Document",
    description: "Check a policy document against a compliance document for gaps.",
    icon: BookOpenCheck,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10",
  },
  {
    id: "offer-employment",
    title: "Offer Letter vs Employment Contract",
    description: "Verify an offer letter's terms carry through to the employment contract.",
    icon: Mail,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-500/10",
  },
  {
    id: "delivery-invoice",
    title: "Delivery Note vs Invoice",
    description: "Match a delivery note's quantities against what was invoiced.",
    icon: Truck,
    iconColor: "text-teal-500",
    iconBg: "bg-teal-500/10",
  },
  {
    id: "universal",
    title: "Universal Comparator",
    description: "Compare any two documents of the same or different type, field by field.",
    icon: ArrowLeftRight,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
  },
];

const slotConfigs: Record<SlotKey, SlotConfig> = {
  po: {
    key: "po",
    kind: "PO",
    label: "Document A · Purchase Order",
    shortLabel: "PO",
    subLabel: "Upload Purchase Order",
    icon: ClipboardList,
    iconColor: "text-brand",
    iconBg: "bg-brand/10",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc,.rtf",
  },
  invoice: {
    key: "invoice",
    kind: "Invoice",
    label: "Document B · Invoice",
    shortLabel: "INV",
    subLabel: "Upload Vendor Invoice",
    icon: Receipt,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc,.rtf",
  },
};

/* ─────────────────── File Type Utils ────────────────── */

const fileTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  pdf: { icon: FileText, label: "PDF", color: "text-red-500", bg: "bg-red-500/10" },
  image: { icon: ImageIcon, label: "Image", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  excel: { icon: FileSpreadsheet, label: "Excel", color: "text-green-600", bg: "bg-green-600/10" },
  word: { icon: FileType2, label: "Word", color: "text-blue-600", bg: "bg-blue-600/10" },
};

/* ────────────────── Phase UI Config ─────────────────── */

const phaseConfig: Record<string, { label: string; sublabel: string; icon: React.ElementType }> = {
  uploading: { label: "Uploading file…", sublabel: "Transferring document to secure storage", icon: Upload },
  extracting: { label: "Running AI Extraction…", sublabel: "Gemini is parsing document fields", icon: Brain },
  schema: { label: "Generating Structured Schema…", sublabel: "Building normalized data representation", icon: DatabaseZap },
  complete: { label: "Ready for Comparison", sublabel: "All fields extracted and validated", icon: CheckCircle2 },
  error: { label: "Processing Failed", sublabel: "Something went wrong, try again", icon: AlertTriangle },
};

/* ─────────────── Connector Arrow ────────────────────── */

function ConnectorArrow({ leftDone, rightDone }: { leftDone: boolean; rightDone: boolean }) {
  const bothDone = leftDone && rightDone;

  return (
    <div className="flex items-center justify-center shrink-0 py-2 lg:py-0 lg:px-0.5">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500",
        bothDone
          ? "bg-success/15 border border-success/30"
          : leftDone || rightDone
          ? "bg-brand/10 border border-brand/20"
          : "bg-muted/60 border border-border/50"
      )}>
        <ArrowRight className={cn(
          "w-3.5 h-3.5 transition-colors duration-300",
          bothDone ? "text-success" : leftDone || rightDone ? "text-brand" : "text-muted-foreground/40"
        )} />
      </div>
    </div>
  );
}

/* ──────────────────── Dropzone Card ─────────────────── */

interface DropzoneProps {
  config: SlotConfig;
  slot: PipelineState;
  onFileDrop: (file: File) => void;
  onReset: () => void;
  onDragOver: (over: boolean) => void;
}

function DropzoneCard({ config, slot, onFileDrop, onReset, onDragOver }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = slot.phase !== "idle" && slot.phase !== "complete" && slot.phase !== "error";
  const isComplete = slot.phase === "complete";
  const isError = slot.phase === "error";
  const isIdle = slot.phase === "idle";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isIdle) onDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(false);
    if (!isIdle) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileDrop(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileDrop(file);
    e.target.value = "";
  };

  const Icon = config.icon;
  const phaseInfo = phaseConfig[slot.phase];

  return (
    <Card
      className={cn(
        "relative flex-1 border-2 transition-all duration-300 overflow-hidden",
        slot.isDragOver ? "border-brand bg-brand/[0.03] scale-[1.01]" : "border-dashed border-border/70",
        isComplete && "border-solid border-success/40 bg-success/[0.02]",
        isError && "border-solid border-destructive/40 bg-destructive/[0.02]",
        "lg:min-w-[300px]"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-5">
        <input ref={inputRef} type="file" accept={config.accept} className="hidden" onChange={handleFileInput} />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", config.iconBg)}>
              <Icon className={cn("w-4 h-4", config.iconColor)} />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">{config.label}</p>
              {!config.required && <span className="text-[10px] text-muted-foreground">Optional</span>}
            </div>
          </div>
        </div>

        {isIdle && (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer"
          >
            <Upload className="w-6 h-6 text-muted-foreground/50" />
            <span className="text-xs font-medium text-muted-foreground">{config.subLabel}</span>
            <span className="text-[10px] text-muted-foreground/60">Drag & drop or click to browse</span>
          </button>
        )}

        {isProcessing && phaseInfo && (
          <div className="py-6 space-y-3">
            <div className="flex items-center gap-2">
              <phaseInfo.icon className="w-4 h-4 text-brand animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{phaseInfo.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{phaseInfo.sublabel}</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${slot.progress}%` }}
              />
            </div>
            {slot.file && <p className="text-[10px] text-muted-foreground/70 truncate">{slot.file.name}</p>}
          </div>
        )}

        {isComplete && slot.file && (
          <div className="py-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", fileTypeConfig[slot.file.type].bg)}>
                {React.createElement(fileTypeConfig[slot.file.type].icon, { className: cn("w-3.5 h-3.5", fileTypeConfig[slot.file.type].color) })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{slot.file.name}</p>
                <p className="text-[10px] text-muted-foreground">{slot.file.size}</p>
              </div>
              <button onClick={onReset} className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <Badge className="rounded-full px-2.5 py-0.5 text-[10px] font-medium border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Extracted · <span className="tabular-nums">{slot.confidence}%</span> confidence
            </Badge>
            {slot.extractedData?.vendorName && (
              <p className="text-[10px] text-muted-foreground truncate">Vendor: {slot.extractedData.vendorName}</p>
            )}
          </div>
        )}

        {isError && (
          <div className="py-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive leading-relaxed">{slot.error}</p>
            </div>
            <button
              onClick={onReset}
              className="h-7 text-[10px] gap-1.5 inline-flex items-center rounded-md border border-border px-2.5 hover:bg-secondary transition-colors"
            >
              <RefreshCcw className="w-3 h-3" />
              Try Again
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────── Main Component ────────────────── */

interface DocumentComparatorProps {
  onComparisonCreated: (comparisonId: string) => void;
}

/** Only "po-invoice" reproduces the original copy exactly, byte for byte. */
function getPresetMeta(preset: string): { badgeLabel: string; runLabel: string } {
  switch (preset) {
    case "universal":
      return { badgeLabel: "Universal Match", runLabel: "Run Universal Comparison" };
    case "contract":
      return { badgeLabel: "Contract Match", runLabel: "Run Contract Comparison" };
    case "jd-resume":
      return { badgeLabel: "JD vs Resume", runLabel: "Run JD vs Resume Match" };
    case "contract-agreement":
      return { badgeLabel: "Contract vs Agreement", runLabel: "Run Contract vs Agreement Match" };
    case "quotation-po":
      return { badgeLabel: "Quotation vs PO", runLabel: "Run Quotation vs PO Match" };
    case "bank-statement":
      return { badgeLabel: "Statement vs Transactions", runLabel: "Run Statement Reconciliation" };
    case "policy-compliance":
      return { badgeLabel: "Policy vs Compliance", runLabel: "Run Policy vs Compliance Match" };
    case "offer-employment":
      return { badgeLabel: "Offer vs Employment", runLabel: "Run Offer vs Employment Match" };
    case "delivery-invoice":
      return { badgeLabel: "Delivery vs Invoice", runLabel: "Run Delivery vs Invoice Match" };
    default:
      return { badgeLabel: "2-Way Match", runLabel: "Run 2-Way Intelligence Match" };
  }
}

/**
 * Presets that reuse the generic "universal" comparison mode — the same
 * mechanism as the Universal Comparator card, just with different upload
 * labels (see getSlotConfig). Keeps handleRunMatch's mode selection in one
 * place instead of a growing chain of `||` checks.
 */
const UNIVERSAL_MODE_PRESETS = new Set([
  "universal",
  "jd-resume",
  "contract-agreement",
  "quotation-po",
  "bank-statement",
  "policy-compliance",
  "offer-employment",
  "delivery-invoice",
]);

export default function DocumentComparator({ onComparisonCreated }: DocumentComparatorProps) {
  const slotPO = useDocumentPipeline("PO");
  const slotINV = useDocumentPipeline("Invoice");
  const [preset, setPreset] = useState("po-invoice");
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const activeSlots = ["po", "invoice"] as const;
  const slotMap = { po: slotPO, invoice: slotINV };
  const presetMeta = getPresetMeta(preset);

  const allComplete = slotPO.state.phase === "complete" && slotINV.state.phase === "complete";

  const anyProcessing = activeSlots.some((k) => {
    const s = slotMap[k].state;
    return s.phase !== "idle" && s.phase !== "complete" && s.phase !== "error";
  });

  const handleRunMatch = async () => {
    if (!allComplete) return;
    setIsComparing(true);
    setCompareError(null);

    try {
      const documentIds = [slotPO.state.documentId!, slotINV.state.documentId!];

      // Most non-procurement presets reuse the same generic "universal"
      // comparison mode as the Universal preset — only the slot labels above
      // differ. See getSlotConfig / COMPARISON_TYPES for why no backend
      // change is needed.
      const mode: ComparisonMode = UNIVERSAL_MODE_PRESETS.has(preset)
        ? "universal"
        : preset === "contract"
        ? "contract"
        : "2-way";

      // No per-comparison tolerance override from this screen anymore — the
      // backend falls back to the stored default tolerance rules (see
      // Tolerance Rules under Settings) when none is provided.
      const result = await runCompare({ mode, documentIds, presetUsed: preset });
      onComparisonCreated(result.comparisonId);
    } catch (err) {
      setCompareError(err instanceof ApiClientError ? err.message : "Comparison failed. Please try again.");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="stagger-children max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Document Ingestion
          </h2>
          <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Upload two documents for intelligent field-level comparison.
        </p>
      </div>

      {/* ── Comparison Configuration ── */}
      <div className="bg-card rounded-xl border border-border/80 overflow-hidden mb-10">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
            <ScanSearch className="w-4 h-4 text-brand" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Comparison Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Fine-tune how documents are matched and compared
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] font-bold bg-brand/8 text-brand border border-brand/15">
            {presetMeta.badgeLabel}
          </Badge>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            <label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-brand" />
              Comparison Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COMPARISON_TYPES.map((type) => {
                const Icon = type.icon;
                const isActive = preset === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setPreset(type.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer",
                      isActive
                        ? "border-brand bg-brand/[0.04]"
                        : "border-border/60 hover:border-border hover:bg-secondary/40"
                    )}
                  >
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", type.iconBg)}>
                      <Icon className={cn("w-4.5 h-4.5", type.iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold", isActive ? "text-brand" : "text-foreground")}>
                        {type.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                        {type.description}
                      </p>
                    </div>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-brand shrink-0 ml-auto" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Every comparison type runs on the same AI extraction and field-diff engine — only the
              document labels and matching rules above change.
            </p>
          </div>
        </div>
      </div>

      {/* ── Document flow indicator ── */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {activeSlots.map((key, i) => {
          const cfg = getSlotConfig(key, preset);
          const s = slotMap[key].state;
          const Icon = cfg.icon;
          return (
            <React.Fragment key={key}>
              {i > 0 && (
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
              )}
               <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border-0",
                s.phase === "complete"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : s.phase === "error"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                  : s.phase !== "idle"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400"
                  : "bg-slate-100 text-slate-700"
              )}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.shortLabel}
                {s.phase === "complete" && <CheckCircle2 className="w-3 h-3" />}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Handwritten/readability note ── */}
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 mb-4">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Note:</span> If a document is
          handwritten and not sufficiently readable, the accuracy of the generated results may
          be affected.
        </p>
      </div>

      {/* ── Dropzones ── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-10">
        <DropzoneCard
          config={getSlotConfig("po", preset)}
          slot={slotPO.state}
          onFileDrop={slotPO.startUpload}
          onReset={slotPO.reset}
          onDragOver={slotPO.setDragOver}
        />

        <ConnectorArrow
          leftDone={slotPO.state.phase === "complete"}
          rightDone={slotINV.state.phase === "complete"}
        />

        <DropzoneCard
          config={getSlotConfig("invoice", preset)}
          slot={slotINV.state}
          onFileDrop={slotINV.startUpload}
          onReset={slotINV.reset}
          onDragOver={slotINV.setDragOver}
        />
      </div>

      {/* ── Run Intelligence Match Button ── */}
      <div className="flex flex-col items-center gap-3">
        <button
          disabled={!allComplete || isComparing}
          onClick={handleRunMatch}
          className={cn(
            "group relative px-10 py-4 rounded-2xl font-semibold text-sm transition-all duration-500 overflow-hidden",
            allComplete && !isComparing
              ? "bg-brand text-brand-foreground shadow-[0_0_40px_-10px] shadow-brand/40 hover:shadow-[0_0_50px_-8px] hover:shadow-brand/50 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {allComplete && !isComparing && (
            <>
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand via-violet-500 to-brand opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-sm" />
              <span className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-brand/40 via-violet-500/40 to-brand/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-md -z-10 animate-pulse" />
            </>
          )}
          <span className="relative flex items-center gap-2.5">
            {isComparing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : allComplete ? (
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
            ) : (
              <ArrowLeftRight className="w-5 h-5" />
            )}
            {isComparing ? "Running Comparison…" : presetMeta.runLabel}
            {allComplete && !isComparing && (
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold ml-1">
                2 Docs Ready
              </Badge>
            )}
          </span>
        </button>

        {compareError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {compareError}
          </p>
        )}

        {/* Bottom hint */}
        <p className="text-center text-[11px] text-muted-foreground/50">
          {allComplete
            ? "Both documents staged and validated. Click above to begin the 2-way intelligence match."
            : anyProcessing
            ? "Processing documents, please wait for AI extraction to complete."
            : "Upload both documents to enable comparison."}
        </p>
      </div>
    </div>
  );
}
