"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Languages,
  Upload,
  FileText,
  X,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  Download,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadFiles } from "@/lib/uploadthing/react";
import { translateDocumentFile, ApiClientError, type TranslateResponse } from "@/lib/api-client";
import {
  DIRECTION_LABELS,
  LANGUAGE_LABELS,
  directionSource,
  directionTarget,
  type TranslationDirection,
} from "@/types/translation";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.txt,.csv,.xlsx,.xls";
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

const DIRECTIONS: TranslationDirection[] = ["en-mr", "mr-en"];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Small copy-to-clipboard button that confirms inline for a moment. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is unavailable on insecure origins — the text is on screen
      // and selectable, so there's nothing useful to surface here.
    }
  };

  return (
    <Button variant="ghost" size="xs" onClick={handleCopy} className="gap-1 text-[11px]">
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export default function DocumentTranslation() {
  const [file, setFile] = useState<File | null>(null);
  const [direction, setDirection] = useState<TranslationDirection>("en-mr");
  const [phase, setPhase] = useState<"upload" | "running" | "results">("upload");
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback((incoming: FileList | File[]) => {
    const picked = Array.from(incoming)[0];
    if (!picked) return;
    if (picked.size > MAX_FILE_SIZE_BYTES) {
      setError(`"${picked.name}" is larger than 16MB.`);
      return;
    }
    setError(null);
    setFile(picked);
  }, []);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgressLabel("");
    setPhase("upload");
  };

  const handleTranslate = async () => {
    if (!file) return;
    setPhase("running");
    setError(null);

    try {
      setProgressLabel(`Uploading ${file.name}…`);
      const uploaded = await uploadFiles("genericUploader", { files: [file] });
      const serverData = uploaded?.[0]?.serverData;
      if (!serverData) throw new Error(`Upload failed for ${file.name}.`);

      setProgressLabel(
        `Translating ${LANGUAGE_LABELS[directionSource(direction)]} → ${
          LANGUAGE_LABELS[directionTarget(direction)]
        }…`
      );
      const data = await translateDocumentFile({
        direction,
        file: {
          fileUrl: serverData.fileUrl,
          fileName: serverData.fileName,
          fileSize: serverData.fileSize,
          mimeType: serverData.mimeType,
        },
      });

      setResult(data);
      setPhase("results");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Translation failed."
      );
      setPhase("upload");
    }
  };

  /** Downloads the translation as a UTF-8 .txt file (Devanagari-safe). */
  const handleDownload = () => {
    if (!result) return;
    const header = `${result.file.fileName}\n${DIRECTION_LABELS[result.direction]}\n${"—".repeat(40)}\n\n`;
    const blob = new Blob([header + result.result.translatedText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.file.fileName.replace(/\.[^.]+$/, "")}-${directionTarget(
      result.direction
    )}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ─────────────── Running state ─────────────── */
  if (phase === "running") {
    return (
      <div className="max-w-[900px] mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
          <Languages className="w-7 h-7 text-brand animate-pulse" />
        </div>
        <p className="text-sm font-semibold">Translating Document</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {progressLabel}
        </p>
        <p className="text-[11px] text-muted-foreground/60 max-w-sm">
          The AI is reading the whole document so it can translate in context and keep the original
          layout — headings, tables, and line breaks stay where they were.
        </p>
      </div>
    );
  }

  /* ─────────────── Results state ─────────────── */
  if (phase === "results" && result) {
    const { result: translation } = result;
    const targetLabel = LANGUAGE_LABELS[directionTarget(result.direction)];
    const sourceLabel = LANGUAGE_LABELS[directionSource(result.direction)];

    return (
      <div className="stagger-children max-w-[1100px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold tracking-tight truncate">{result.file.fileName}</h2>
              <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold shrink-0">
                {DIRECTION_LABELS[result.direction]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Translation confidence {Math.round(translation.confidence * 100)}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCcw className="w-3.5 h-3.5" />
              New translation
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="gap-1.5 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              <Download className="w-3.5 h-3.5" />
              Download .txt
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {translation.directionMismatch && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              You chose <span className="font-semibold text-foreground">{sourceLabel}</span> as the
              source, but this document looks like it&apos;s written in{" "}
              <span className="font-semibold text-foreground">
                {translation.detectedLanguage === "other"
                  ? "another language"
                  : LANGUAGE_LABELS[translation.detectedLanguage]}
              </span>
              . It was still translated into {targetLabel} — double-check the result, or switch the
              direction and try again.
            </p>
          </div>
        )}
        {translation.truncated && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              This document was long enough that only the first portion could be translated.
            </p>
          </div>
        )}

        {/* Side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="py-3 px-5 border-b border-border/40 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Original · {sourceLabel}
              </CardTitle>
              <CopyButton text={translation.sourceText} label="Copy" />
            </CardHeader>
            <CardContent className="p-5">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans text-muted-foreground max-h-[560px] overflow-y-auto">
                {translation.sourceText || "No source text was transcribed."}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-brand/30 shadow-sm">
            <CardHeader className="py-3 px-5 border-b border-border/40 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-brand">
                Translation · {targetLabel}
              </CardTitle>
              <CopyButton text={translation.translatedText} label="Copy" />
            </CardHeader>
            <CardContent className="p-5">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans text-foreground max-h-[560px] overflow-y-auto">
                {translation.translatedText}
              </pre>
            </CardContent>
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          Machine translation — have a fluent speaker review anything legally or financially
          binding before you rely on it.
        </p>
      </div>
    );
  }

  /* ─────────────── Upload state ─────────────── */
  return (
    <div className="stagger-children max-w-[900px] mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Document Translation</h2>
          <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 mr-1" />
            English ⇄ Marathi
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Upload a document and get it translated between English and Marathi. The layout is kept
          intact, and numbers, dates, GSTINs, and invoice references are left exactly as they are.
        </p>
      </div>

      {/* Direction picker */}
      <Card className="border-border/80 shadow-sm mb-4">
        <CardHeader className="py-4 px-6 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">Translation direction</CardTitle>
          <CardDescription className="text-xs">
            Pick which way to translate — this pair only
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DIRECTIONS.map((dir) => {
              const isActive = direction === dir;
              return (
                <button
                  key={dir}
                  onClick={() => setDirection(dir)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center justify-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all duration-200",
                    isActive
                      ? "border-brand bg-brand/[0.06]"
                      : "border-border/60 hover:border-border hover:bg-secondary/40"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isActive ? "text-brand" : "text-foreground"
                    )}
                  >
                    {LANGUAGE_LABELS[directionSource(dir)]}
                  </span>
                  <ArrowRight
                    className={cn(
                      "w-4 h-4",
                      isActive ? "text-brand" : "text-muted-foreground/50"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isActive ? "text-brand" : "text-foreground"
                    )}
                  >
                    {LANGUAGE_LABELS[directionTarget(dir)]}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dropzone */}
      <Card
        className={cn(
          "border-2 transition-all duration-300 mb-6",
          isDragOver ? "border-brand bg-brand/[0.03]" : "border-dashed border-border/70"
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
          if (e.dataTransfer.files?.length) selectFile(e.dataTransfer.files);
        }}
      >
        <CardContent className="p-8">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) selectFile(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer"
          >
            <Upload className="w-7 h-7 text-muted-foreground/50" />
            <span className="text-sm font-medium text-muted-foreground">
              {file ? "Choose a different document" : "Add a document"}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              PDF, image, Word, Excel/CSV, or text · up to 16MB · drag &amp; drop or click
            </span>
          </button>

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
              <FileText className="w-4 h-4 text-brand shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{file.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              <button
                onClick={() => setFile(null)}
                aria-label="Remove file"
                className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
        <Button
          onClick={handleTranslate}
          disabled={!file}
          className="gap-2 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl px-6 h-10"
        >
          <Languages className="w-4 h-4" />
          Translate {DIRECTION_LABELS[direction]}
        </Button>
        <p className="text-[11px] text-muted-foreground/50">
          {file ? "Ready to translate." : "Add a document to continue."}
        </p>
      </div>
    </div>
  );
}
