"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Sparkles,
  Upload,
  FileText,
  X,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ArrowLeftRight,
  ScrollText,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadFiles } from "@/lib/uploadthing/react";
import {
  runIntelligentCompare,
  ApiClientError,
  type IntelligentComparisonResponse,
} from "@/lib/api-client";
import type { AlignedStatus } from "@/types/intelligent";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc,.txt";
const MIN_FILES = 2;
const MAX_FILES = 5;

interface StagedFile {
  id: string;
  file: File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<AlignedStatus, { label: string; className: string }> = {
  match: { label: "Match", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
  mismatch: { label: "Mismatch", className: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" },
  only_in_one: { label: "Only in one", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
  critical: "bg-destructive/15 text-destructive",
};

const VERDICT_STYLES: Record<string, string> = {
  "Strong Match": "bg-success/10 text-success border-success/20",
  "Partial Match": "bg-warning/10 text-warning border-warning/20",
  "Weak Match": "bg-destructive/10 text-destructive border-destructive/20",
  Divergent: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function IntelligentComparison() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [phase, setPhase] = useState<"upload" | "running" | "results">("upload");
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntelligentComparisonResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    // Snapshot into a real array *now* — callers clear the <input> value right
    // after, which empties a live FileList before this deferred updater runs.
    const list = Array.from(incoming);
    setError(null);
    setStaged((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (next.length >= MAX_FILES) break;
        if (next.some((s) => s.file.name === file.name && s.file.size === file.size)) continue;
        next.push({ id: `${file.name}-${file.size}-${Date.now()}-${next.length}`, file });
      }
      return next;
    });
  }, []);

  const removeFile = (id: string) => setStaged((prev) => prev.filter((s) => s.id !== id));

  const reset = () => {
    setStaged([]);
    setResult(null);
    setError(null);
    setProgressLabel("");
    setPhase("upload");
  };

  const handleRun = async () => {
    if (staged.length < MIN_FILES) return;
    setPhase("running");
    setError(null);

    try {
      const uploaded: { fileUrl: string; fileName: string; fileSize: number; mimeType: string }[] = [];

      for (let i = 0; i < staged.length; i++) {
        setProgressLabel(`Uploading ${staged[i].file.name} (${i + 1}/${staged.length})…`);
        const res = await uploadFiles("genericUploader", { files: [staged[i].file] });
        const serverData = res?.[0]?.serverData;
        if (!serverData) throw new Error(`Upload failed for ${staged[i].file.name}.`);
        uploaded.push({
          fileUrl: serverData.fileUrl,
          fileName: serverData.fileName,
          fileSize: serverData.fileSize,
          mimeType: serverData.mimeType,
        });
      }

      setProgressLabel("Analyzing and comparing documents with AI…");
      const data = await runIntelligentCompare({ files: uploaded });
      setResult(data);
      setPhase("results");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Intelligent comparison failed.",
      );
      setPhase("upload");
    }
  };

  /* ─────────────── Running state ─────────────── */
  if (phase === "running") {
    return (
      <div className="max-w-[900px] mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
          <Brain className="w-7 h-7 text-brand animate-pulse" />
        </div>
        <p className="text-sm font-semibold">Running Intelligent Comparison</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {progressLabel}
        </p>
        <p className="text-[11px] text-muted-foreground/60 max-w-sm">
          The AI is reading each document in full, summarizing it, and lining up the aspects that
          correspond between them. This can take up to a minute.
        </p>
      </div>
    );
  }

  /* ─────────────── Results state ─────────────── */
  if (phase === "results" && result) {
    const { documentSummaries, comparison } = result;
    return (
      <div className="stagger-children max-w-[1200px] mx-auto space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <button
            onClick={reset}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            New Intelligent Comparison
          </button>
          <Badge
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold border",
              VERDICT_STYLES[comparison.verdict.rating] ?? "bg-secondary text-foreground border-border",
            )}
          >
            {comparison.verdict.rating}
          </Badge>
        </div>

        {/* Overview */}
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-brand to-violet-500" />
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-brand" />
              {comparison.documentsCompared}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">{comparison.overview}</p>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-xs font-semibold mb-1">Verdict — {comparison.verdict.rating}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {comparison.verdict.rationale}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Per-document summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentSummaries.map((doc) => (
            <Card key={doc.index} className="border-border/80 shadow-sm">
              <CardHeader className="py-4 px-5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{doc.title}</CardTitle>
                    <CardDescription className="text-[11px] truncate">
                      {doc.detectedType} · {doc.fileName}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">{doc.summary}</p>
                {doc.keyPoints.length > 0 && (
                  <ul className="space-y-1 list-disc pl-4 marker:text-brand text-xs text-muted-foreground">
                    {doc.keyPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Aligned findings */}
        {comparison.alignedFindings.length > 0 && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="py-4 px-6 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-brand" />
                Aligned Findings
              </CardTitle>
              <CardDescription className="text-xs">
                Aspects lined up across the documents, with how they relate
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {comparison.alignedFindings.map((finding, i) => {
                const status = STATUS_STYLES[finding.status];
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{finding.aspect}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge className={cn("text-[9px] font-bold uppercase border-0", status.className)}>
                          {status.label}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-[9px] font-bold uppercase border-0",
                            SEVERITY_STYLES[finding.severity] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {finding.severity}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {finding.perDocument.map((pd) => {
                        const src = documentSummaries.find((d) => d.index === pd.index);
                        return (
                          <div
                            key={pd.index}
                            className="text-[11px] rounded-md bg-card border border-border/40 px-2.5 py-1.5"
                          >
                            <span className="text-muted-foreground/70 block">
                              {src?.title ?? `Document ${pd.index + 1}`}
                            </span>
                            <span className="text-foreground">{pd.value}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{finding.details}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Similarities & differences */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="py-4 px-5 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Key Similarities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {comparison.keySimilarities.length > 0 ? (
                <ul className="space-y-1.5 list-disc pl-4 marker:text-success text-xs text-muted-foreground">
                  {comparison.keySimilarities.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground/70">None identified.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="py-4 px-5 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Key Differences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {comparison.keyDifferences.length > 0 ? (
                <ul className="space-y-1.5 list-disc pl-4 marker:text-destructive text-xs text-muted-foreground">
                  {comparison.keyDifferences.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground/70">None identified.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* ─────────────── Upload state ─────────────── */
  return (
    <div className="stagger-children max-w-[900px] mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Intelligent Comparison</h2>
          <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 mr-1" />
            Any Documents
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Upload any {MIN_FILES}–{MAX_FILES} documents of any type — a résumé and a job description,
          two contract revisions, a PO and an invoice, two reports. The AI reads each one, summarizes
          it, and compares them in context.
        </p>
      </div>

      <Card
        className={cn(
          "border-2 transition-all duration-300 mb-6",
          isDragOver ? "border-brand bg-brand/[0.03]" : "border-dashed border-border/70",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <CardContent className="p-8">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={staged.length >= MAX_FILES}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-7 h-7 text-muted-foreground/50" />
            <span className="text-sm font-medium text-muted-foreground">
              {staged.length >= MAX_FILES ? `Maximum ${MAX_FILES} documents` : "Add documents"}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              PDF, image, Word, Excel/CSV, or text · drag & drop or click
            </span>
          </button>

          {staged.length > 0 && (
            <div className="mt-4 space-y-2">
              {staged.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
                >
                  <FileText className="w-4 h-4 text-brand shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{s.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(s.file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(s.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5 justify-center mb-4">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          {staged.length > 0 && (
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCcw className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
          <Button
            onClick={handleRun}
            disabled={staged.length < MIN_FILES}
            className="gap-2 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl px-6 h-10"
          >
            <Sparkles className="w-4 h-4" />
            Run Intelligent Comparison
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground/50">
          {staged.length < MIN_FILES
            ? `Add at least ${MIN_FILES} documents to continue.`
            : `${staged.length} documents staged.`}
        </p>
      </div>
    </div>
  );
}
