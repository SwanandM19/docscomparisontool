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
  Plus,
  PackageCheck,
  Receipt,
  ClipboardList,
  Trash2,
  ArrowRight,
  AlertTriangle,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDocumentPipeline, type PipelineState } from "@/lib/hooks/use-document-pipeline";
import { runCompare, ApiClientError } from "@/lib/api-client";
import type { DocumentKind } from "@/types/document";
import type { ComparisonMode } from "@/types/comparison";

/* ─────────────────────── Types ─────────────────────── */

type SlotKey = "po" | "grn" | "invoice";

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

const NON_PROCUREMENT_PRESETS = new Set(["universal", "contract"]);

/**
 * "po" and "invoice" slot labels are procurement-specific by default; when
 * the user picks a non-procurement preset (Universal / Contract), the slot
 * copy is swapped to something that doesn't imply a PO/Invoice pairing.
 */
function getSlotConfig(key: "po" | "invoice", preset: string): SlotConfig {
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

  return base;
}

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
    accept: ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc",
  },
  grn: {
    key: "grn",
    kind: "GRN",
    label: "Document B · Goods Receipt Note",
    shortLabel: "GRN",
    subLabel: "Upload Goods Receipt Note",
    icon: PackageCheck,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
    required: false,
    accept: ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc",
  },
  invoice: {
    key: "invoice",
    kind: "Invoice",
    label: "Document C · Invoice",
    shortLabel: "INV",
    subLabel: "Upload Vendor Invoice",
    icon: Receipt,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    required: true,
    accept: ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc",
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
  error: { label: "Processing Failed", sublabel: "Something went wrong — try again", icon: AlertTriangle },
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
  onRemoveSlot?: () => void;
  compact?: boolean;
}

function DropzoneCard({ config, slot, onFileDrop, onReset, onDragOver, onRemoveSlot, compact }: DropzoneProps) {
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
        compact ? "lg:min-w-[240px]" : "lg:min-w-[300px]"
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
          {onRemoveSlot && (
            <button onClick={onRemoveSlot} className="text-muted-foreground/50 hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
            <Button size="sm" variant="outline" onClick={onReset} className="h-7 text-[10px] gap-1.5">
              <RefreshCcw className="w-3 h-3" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────── Add Slot Card ────────────────── */

function AddSlotCard({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="flex-1 border-2 border-dashed border-border/50 hover:border-amber-500/30 transition-all duration-300 cursor-pointer group lg:min-w-[240px]" onClick={onAdd}>
      <CardContent className="p-5 h-full">
        <div className="flex flex-col items-center justify-center gap-3 py-6 h-full">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center group-hover:bg-amber-500/10 group-hover:scale-105 transition-all duration-300">
              <Plus className="w-6 h-6 text-muted-foreground/50 group-hover:text-amber-500 transition-colors duration-300" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-amber-500/0 group-hover:border-amber-500/20 group-hover:scale-110 transition-all duration-500" />
          </div>

          <p className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors mb-1">
            Add GRN Document
          </p>
          <p className="text-xs text-muted-foreground/60 text-center max-w-[200px] mb-3">
            Include a Goods Receipt Note for 3-way matching
          </p>

          <Badge
            variant="secondary"
            className="text-[9px] font-bold tracking-wider uppercase bg-amber-500/8 text-amber-500/70 border border-amber-500/15 px-2.5 py-0.5 group-hover:text-amber-500 group-hover:border-amber-500/30 transition-colors"
          >
            <PackageCheck className="w-3 h-3 mr-1" />
            Optional · 3-Way Match
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/* ──────────────────── Main Component ────────────────── */

interface DocumentComparatorProps {
  onComparisonCreated: (comparisonId: string) => void;
}

export default function DocumentComparator({ onComparisonCreated }: DocumentComparatorProps) {
  const slotPO = useDocumentPipeline("PO");
  const slotGRN = useDocumentPipeline("GRN");
  const slotINV = useDocumentPipeline("Invoice");
  const [showGRN, setShowGRN] = useState(false);
  const [preset, setPreset] = useState("po-invoice");
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const activeSlots = showGRN ? (["po", "grn", "invoice"] as const) : (["po", "invoice"] as const);
  const slotMap = { po: slotPO, grn: slotGRN, invoice: slotINV };

  const allRequiredComplete = slotPO.state.phase === "complete" && slotINV.state.phase === "complete";
  const grnComplete = !showGRN || slotGRN.state.phase === "complete";
  const allComplete = allRequiredComplete && grnComplete;

  const anyProcessing = activeSlots.some((k) => {
    const s = slotMap[k].state;
    return s.phase !== "idle" && s.phase !== "complete" && s.phase !== "error";
  });

  const handleAddGRN = () => {
    setShowGRN(true);
    setPreset("po-grn-invoice");
  };

  const handleRemoveGRN = () => {
    slotGRN.reset();
    setShowGRN(false);
    setPreset("po-invoice");
  };

  const handlePresetChange = (val: string | null) => {
    if (!val) return;
    setPreset(val);
    // Universal/Contract modes are 2-way only — drop any staged GRN slot
    // rather than asking the user to reconcile a 3rd document that no
    // longer has a meaningful role in these presets.
    if (NON_PROCUREMENT_PRESETS.has(val) && showGRN) {
      slotGRN.reset();
      setShowGRN(false);
    }
  };

  const matchLabel = showGRN ? "3-Way Intelligence Match" : "2-Way Intelligence Match";
  const docCount = showGRN ? 3 : 2;

  const handleRunMatch = async () => {
    if (!allComplete) return;
    setIsComparing(true);
    setCompareError(null);

    try {
      const documentIds = showGRN
        ? [slotPO.state.documentId!, slotGRN.state.documentId!, slotINV.state.documentId!]
        : [slotPO.state.documentId!, slotINV.state.documentId!];

      const mode: ComparisonMode = showGRN
        ? "3-way"
        : preset === "universal"
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
          Upload {showGRN ? "three" : "two"} documents for intelligent field-level comparison.
          {showGRN
            ? " PO + GRN + Invoice enables complete 3-way matching."
            : " Add a GRN for complete 3-way matching."}
        </p>
      </div>

      {/* ── Document flow indicator ── */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {activeSlots.map((key, i) => {
          const cfg = key === "grn" ? slotConfigs.grn : getSlotConfig(key, preset);
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

      {/* ── Dropzones ── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-10">
        <DropzoneCard
          config={getSlotConfig("po", preset)}
          slot={slotPO.state}
          onFileDrop={slotPO.startUpload}
          onReset={slotPO.reset}
          onDragOver={slotPO.setDragOver}
          compact={showGRN}
        />

        <ConnectorArrow
          leftDone={slotPO.state.phase === "complete"}
          rightDone={showGRN ? slotGRN.state.phase === "complete" : slotINV.state.phase === "complete"}
        />

        {showGRN ? (
          <>
            <DropzoneCard
              config={slotConfigs.grn}
              slot={slotGRN.state}
              onFileDrop={slotGRN.startUpload}
              onReset={slotGRN.reset}
              onDragOver={slotGRN.setDragOver}
              onRemoveSlot={handleRemoveGRN}
              compact
            />
            <ConnectorArrow
              leftDone={slotGRN.state.phase === "complete"}
              rightDone={slotINV.state.phase === "complete"}
            />
          </>
        ) : NON_PROCUREMENT_PRESETS.has(preset) ? (
          <ConnectorArrow leftDone={slotPO.state.phase === "complete"} rightDone={slotINV.state.phase === "complete"} />
        ) : (
          <>
            <AddSlotCard onAdd={handleAddGRN} />
            <ConnectorArrow leftDone={false} rightDone={slotINV.state.phase === "complete"} />
          </>
        )}

        <DropzoneCard
          config={getSlotConfig("invoice", preset)}
          slot={slotINV.state}
          onFileDrop={slotINV.startUpload}
          onReset={slotINV.reset}
          onDragOver={slotINV.setDragOver}
          compact={showGRN}
        />
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
            {docCount}-Way Match
          </Badge>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-brand" />
                Comparison Preset / Template
              </label>
              <Select value={preset} onValueChange={handlePresetChange} disabled={showGRN}>
                <SelectTrigger className="w-full h-10 text-sm bg-secondary/50 border-border">
                  <SelectValue placeholder="Select a preset…" />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6}>
                  <SelectItem value="po-invoice">
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-brand" />
                      PO vs Invoice (2-Way)
                    </span>
                  </SelectItem>
                  <SelectItem value="po-grn-invoice" disabled>
                    <span className="flex items-center gap-2">
                      <PackageCheck className="w-3.5 h-3.5 text-amber-500" />
                      PO + GRN + Invoice (3-Way)
                    </span>
                  </SelectItem>
                  <SelectItem value="universal">
                    <span className="flex items-center gap-2">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-violet-500" />
                      Universal Comparator
                    </span>
                  </SelectItem>
                  <SelectItem value="contract">
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                      Contract Clause Matcher
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {showGRN
                  ? "3-way matching cross-references PO quantities with GRN deliveries and Invoice line items."
                  : "Presets define field mappings and matching rules optimized for specific document pair types."}
              </p>
            </div>
          </div>
        </div>
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
            {isComparing ? "Running Comparison…" : `Run ${matchLabel}`}
            {allComplete && !isComparing && (
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold ml-1">
                {docCount} Docs Ready
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
            ? `All ${docCount} documents staged and validated. Click above to begin ${matchLabel.toLowerCase()}.`
            : anyProcessing
            ? "Processing documents — please wait for AI extraction to complete."
            : showGRN
            ? "Upload all three documents (PO + GRN + Invoice) to enable 3-way matching."
            : "Upload both documents to enable comparison. Add a GRN for 3-way matching."}
        </p>
      </div>
    </div>
  );
}
