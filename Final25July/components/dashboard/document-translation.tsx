"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildRtfDocument, downloadRtf, type RtfBlock } from "@/lib/rtf";
import { uploadFiles } from "@/lib/uploadthing/react";
import {
  translateDocumentFile,
  getTranslation,
  renderTranslationPdf,
  ApiClientError,
  type TranslateResponse,
} from "@/lib/api-client";
import {
  LANGUAGE_LABELS,
  LANGUAGE_CODES,
  directionSource,
  directionTarget,
  directionLabel,
  type TranslationDirection,
  type TranslationLanguage,
} from "@/types/translation";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.rtf,.txt,.csv,.xlsx,.xls";
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

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

interface DocumentTranslationProps {
  /** When set, loads and shows this past translation instead of the upload flow. */
  initialTranslationId?: string;
}

export default function DocumentTranslation({ initialTranslationId }: DocumentTranslationProps) {
  const [file, setFile] = useState<File | null>(null);
  const [direction, setDirection] = useState<TranslationDirection>("en-mr");
  const [phase, setPhase] = useState<"upload" | "running" | "results">("upload");
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialTranslationId) return;
    let cancelled = false;
    setPhase("running");
    setProgressLabel("Loading saved translation…");
    setError(null);

    getTranslation(initialTranslationId)
      .then((data) => {
        if (cancelled) return;
        setDirection(data.direction);
        setResult(data);
        setPhase("results");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Could not load this translation.");
        setPhase("upload");
      });

    return () => {
      cancelled = true;
    };
  }, [initialTranslationId]);

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

  const sourceLang = directionSource(direction);
  const targetLang = directionTarget(direction);

  const setSourceLang = (lang: TranslationLanguage) => {
    const nextTarget = lang === targetLang ? LANGUAGE_CODES.find((c) => c !== lang)! : targetLang;
    setDirection(`${lang}-${nextTarget}` as TranslationDirection);
  };

  const setTargetLang = (lang: TranslationLanguage) => {
    const nextSource = lang === sourceLang ? LANGUAGE_CODES.find((c) => c !== lang)! : sourceLang;
    setDirection(`${nextSource}-${lang}` as TranslationDirection);
  };

  const swapLanguages = () => setDirection(`${targetLang}-${sourceLang}` as TranslationDirection);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgressLabel("");
    setPdfError(null);
    setPdfBusy(false);
    setPhase("upload");
  };

  const handleTranslate = async () => {
    if (!file) return;
    setPhase("running");
    setError(null);

    try {
      setProgressLabel(`Uploading ${file.name}…`);
      let serverData;
      try {
        const uploaded = await uploadFiles("genericUploader", { files: [file] });
        serverData = uploaded?.[0]?.serverData;
      } catch (uploadErr) {
        console.error("[translation] upload failed:", uploadErr);
        throw new Error(
          uploadErr instanceof Error
            ? `Upload failed: ${uploadErr.message}`
            : `Could not upload "${file.name}".`
        );
      }
      if (!serverData) throw new Error(`Upload of "${file.name}" did not complete.`);

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

      if (!data?.result?.translatedText) {
        throw new Error("The translator returned an empty result. Please try again.");
      }

      setResult(data);
      setPhase("results");
    } catch (err) {
      console.error("[translation] failed:", err);
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

  /**
   * Downloads a side-by-side .rtf document (original + translation) that opens
   * cleanly in Word / LibreOffice so the two versions can be compared there.
   * Works the same for English→Marathi and Marathi→English.
   */
  const handleDownloadRtf = () => {
    if (!result) return;
    const sourceLabel = LANGUAGE_LABELS[directionSource(result.direction)];
    const targetLabel = LANGUAGE_LABELS[directionTarget(result.direction)];
    const blocks: RtfBlock[] = [
      { style: "h1", text: result.file.fileName },
      {
        style: "p",
        text: `${directionLabel(result.direction)}  ·  Translation confidence ${Math.round(
          result.result.confidence * 100
        )}%`,
      },
      { style: "h2", text: `Original: ${sourceLabel}` },
      { style: "p", text: result.result.sourceText || "No source text was transcribed." },
      { style: "h2", text: `Translation: ${targetLabel}` },
      { style: "p", text: result.result.translatedText },
    ];
    const base = result.file.fileName.replace(/\.[^.]+$/, "");
    downloadRtf(`${base}-${result.direction}.rtf`, buildRtfDocument(blocks));
  };

  /** Downloads a formatted PDF (original + translation), Devanagari-safe. */
  const handleDownloadPdf = async () => {
    if (!result) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const blob = await renderTranslationPdf({
        fileName: result.file.fileName,
        direction: result.direction,
        sourceText: result.result.sourceText,
        translatedText: result.result.translatedText,
        confidence: result.result.confidence,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.file.fileName.replace(/\.[^.]+$/, "")}-${directionTarget(
        result.direction
      )}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(
        err instanceof ApiClientError ? err.message : "Could not generate the PDF."
      );
    } finally {
      setPdfBusy(false);
    }
  };

  /** Downloads the translation as a UTF-8 .txt file (Devanagari-safe). */
  const handleDownload = () => {
    if (!result) return;
    const header = `${result.file.fileName}\n${directionLabel(result.direction)}\n${"—".repeat(40)}\n\n`;
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
          layout, headings, tables, and line breaks stay where they were.
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
                {directionLabel(result.direction)}
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
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              .txt
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadRtf} className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              .rtf
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={pdfBusy}
              className="gap-1.5 text-xs bg-brand hover:bg-brand/90 text-brand-foreground"
            >
              {pdfBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download .pdf
            </Button>
          </div>
        </div>

        {pdfError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {pdfError}
          </p>
        )}

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
              . It was still translated into {targetLabel}. Double-check the result, or switch the
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
          Download as .pdf for a finished, shareable copy, or .rtf to open in Word / LibreOffice
          with the original and the translation stacked for side-by-side review. Machine
          translation. Have a fluent speaker check anything legally or financially binding.
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
            {LANGUAGE_LABELS[sourceLang]} ⇄ {LANGUAGE_LABELS[targetLang]}
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Upload a PDF, Word, or RTF document and get a word-for-word translation into the
          language you pick below. The layout is kept intact, and numbers, dates, GSTINs, and
          invoice references are left exactly as they are.
        </p>
      </div>

      {/* Language picker */}
      <Card className="border-border/80 shadow-sm mb-4">
        <CardHeader className="py-4 px-6 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">Translation direction</CardTitle>
          <CardDescription className="text-xs">
            Choose the source and target language for this document
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">Source language</label>
              <Select value={sourceLang} onValueChange={(val) => val && setSourceLang(val as TranslationLanguage)}>
                <SelectTrigger className="w-full h-10 text-sm bg-secondary/50 border-border">
                  <SelectValue placeholder="Source language…">
                    {(val: unknown) => LANGUAGE_LABELS[val as TranslationLanguage] ?? "Source language…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6}>
                  {LANGUAGE_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {LANGUAGE_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={swapLanguages}
              aria-label="Swap source and target languages"
              title="Swap languages"
              className="shrink-0 w-9 h-9 mb-0.5 rounded-lg border border-border/70 bg-secondary/40 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-center sm:self-end"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">Target language</label>
              <Select value={targetLang} onValueChange={(val) => val && setTargetLang(val as TranslationLanguage)}>
                <SelectTrigger className="w-full h-10 text-sm bg-secondary/50 border-border">
                  <SelectValue placeholder="Target language…">
                    {(val: unknown) => LANGUAGE_LABELS[val as TranslationLanguage] ?? "Target language…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6}>
                  {LANGUAGE_CODES.filter((code) => code !== sourceLang).map((code) => (
                    <SelectItem key={code} value={code}>
                      {LANGUAGE_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Handwritten/readability note */}
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 mb-4">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Note:</span> If a document is
          handwritten and not sufficiently readable, the accuracy of the generated results may
          be affected.
        </p>
      </div>

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
              PDF, Word (.docx), RTF (.rtf), image, Excel/CSV, or text · {LANGUAGE_LABELS[sourceLang]} ·
              up to 16MB · drag &amp; drop or click
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
          Translate {directionLabel(direction)}
        </Button>
        <p className="text-[11px] text-muted-foreground/50">
          {file ? "Ready to translate." : "Add a document to continue."}
        </p>
      </div>
    </div>
  );
}
