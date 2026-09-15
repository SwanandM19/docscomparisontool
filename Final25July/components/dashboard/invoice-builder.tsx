"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileText,
  X,
  Loader2,
  AlertTriangle,
  Check,
  Copy,
  Download,
  RefreshCcw,
  Sparkles,
  Wand2,
  ScanSearch,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uploadFiles } from "@/lib/uploadthing/react";
import { buildRtfDocument, downloadRtf, type RtfBlock } from "@/lib/rtf";
import {
  detectDocumentFields,
  fillInvoiceDocument,
  renderFilledDocumentPdf,
  ApiClientError,
} from "@/lib/api-client";
import type { DetectedField, FilledField, InvoiceFillResult } from "@/types/invoice-fill";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.rtf,.txt,.csv,.xlsx,.xls";
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

interface UploadedFileInfo {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type Phase = "upload" | "detecting" | "fields" | "running" | "results";

export default function InvoiceBuilder() {
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFileInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Detected layout (Phase A) — one text value per detected field.
  const [documentType, setDocumentType] = useState("");
  const [detectedLayout, setDetectedLayout] = useState("");
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  // Fill result (Phase B).
  const [result, setResult] = useState<InvoiceFillResult | null>(null);
  const [docText, setDocText] = useState("");
  const [fields, setFields] = useState<FilledField[]>([]);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

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
    setUploaded(null);
    setDocumentType("");
    setDetectedLayout("");
    setDetectedFields([]);
    setFieldValues({});
    setNotes("");
    setResult(null);
    setDocText("");
    setFields([]);
    setError(null);
    setPdfError(null);
    setProgressLabel("");
    setPhase("upload");
  };

  /** Phase A: upload the file, then ask the AI to detect its fields. */
  const handleDetect = async () => {
    if (!file) return;
    setPhase("detecting");
    setError(null);
    try {
      setProgressLabel(`Uploading ${file.name}…`);
      const uploadedFiles = await uploadFiles("genericUploader", { files: [file] });
      const serverData = uploadedFiles?.[0]?.serverData;
      if (!serverData) throw new Error(`Upload failed for ${file.name}.`);

      const fileInfo: UploadedFileInfo = {
        fileUrl: serverData.fileUrl,
        fileName: serverData.fileName,
        fileSize: serverData.fileSize,
        mimeType: serverData.mimeType,
      };
      setUploaded(fileInfo);

      setProgressLabel("Reading the document's layout and finding its fields…");
      const data = await detectDocumentFields({ file: fileInfo });

      setDocumentType(data.documentType);
      setDetectedLayout(data.detectedLayout);
      setDetectedFields(data.fields);
      setFieldValues(Object.fromEntries(data.fields.map((f) => [f.id, f.originalValue])));
      setPhase("fields");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not read the document's fields."
      );
      setPhase("upload");
    }
  };

  const setFieldValue = (id: string, value: string) =>
    setFieldValues((prev) => ({ ...prev, [id]: value }));

  const blankCount = detectedFields.filter((f) => f.isBlank).length;

  /** Phase B: send the user's per-field values and fill the document. */
  const handleFill = async () => {
    if (!uploaded) return;
    setPhase("running");
    setError(null);
    try {
      setProgressLabel("Filling in your values and finishing the document…");
      const data = await fillInvoiceDocument({
        file: uploaded,
        fields: detectedFields.map((f) => ({
          id: f.id,
          label: f.label,
          value: fieldValues[f.id] ?? "",
        })),
        notes: notes.trim(),
      });

      setResult(data);
      setDocText(data.filledDocument);
      setFields(data.fields);
      setPhase("results");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not fill the document."
      );
      setPhase("fields");
    }
  };

  const patchField = (id: string, value: string) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, filledValue: value } : f)));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(docText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const baseName = (result ? result.documentType : "filled-document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const handleDownloadRtf = () => {
    if (!result) return;
    const blocks: RtfBlock[] = [
      { style: "h1", text: `${result.documentType} (completed)` },
    ];
    docText.split("\n").forEach((line) => blocks.push({ style: "p", text: line }));
    if (fields.length) {
      blocks.push({ style: "h2", text: "Filled fields" });
      fields.forEach((f) =>
        blocks.push({ style: "p", text: `${f.label}: ${f.filledValue || "(blank)"}` })
      );
    }
    downloadRtf(`${baseName}.rtf`, buildRtfDocument(blocks));
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const blob = await renderFilledDocumentPdf({
        documentType: result.documentType,
        content: docText,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err instanceof ApiClientError ? err.message : "Could not generate the PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  /* ─────────────── Detecting / Running ─────────────── */
  if (phase === "detecting" || phase === "running") {
    const isDetecting = phase === "detecting";
    return (
      <div className="max-w-[900px] mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
          {isDetecting ? (
            <ScanSearch className="w-7 h-7 text-brand animate-pulse" />
          ) : (
            <Wand2 className="w-7 h-7 text-brand animate-pulse" />
          )}
        </div>
        <p className="text-sm font-semibold">
          {isDetecting ? "Reading your document" : "Filling your document"}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {progressLabel}
        </p>
        <p className="text-[11px] text-muted-foreground/60 max-w-sm">
          {isDetecting
            ? "The AI reads your document's exact layout and works out every field on it, and which ones are still blank."
            : "The AI writes your values into the document, doing the line-item and tax arithmetic for you."}
        </p>
      </div>
    );
  }

  /* ─────────────── Fields review (Phase A results) ─────────────── */
  if (phase === "fields") {
    return (
      <div className="stagger-children max-w-[900px] mx-auto space-y-5">
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h2 className="text-2xl font-bold tracking-tight">{documentType || "Detected Document"}</h2>
            {blankCount > 0 && (
              <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
                {blankCount} blank field{blankCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">{detectedLayout}</p>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Fill in the values</CardTitle>
            <CardDescription className="text-xs">
              Fields highlighted in amber were blank on your document. Type a value into any field
              you want filled or changed
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5 max-h-[520px] overflow-y-auto">
            {detectedFields.length === 0 && (
              <p className="text-xs text-muted-foreground/70">
                No discrete fields were detected on this document.
              </p>
            )}
            {detectedFields.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "space-y-1 rounded-lg p-2 -mx-2",
                  f.isBlank && "bg-warning/5 border border-warning/25"
                )}
              >
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  {f.label}
                  {f.isBlank && (
                    <span className="text-[9px] uppercase text-warning font-semibold">blank</span>
                  )}
                </label>
                <Input
                  value={fieldValues[f.id] ?? ""}
                  onChange={(e) => setFieldValue(f.id, e.target.value)}
                  placeholder={f.isBlank ? "Type a value…" : "—"}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="py-3 px-6 border-b border-border/40">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Additional notes (optional)
            </CardTitle>
            <CardDescription className="text-[11px]">
              Anything not covered above, e.g. &quot;make the due date 30 days from the invoice date&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes for the AI"
              className="text-sm"
            />
          </CardContent>
        </Card>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5 justify-center">
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCcw className="w-3.5 h-3.5" />
              Start over
            </Button>
            <Button
              onClick={handleFill}
              className="gap-2 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl px-6 h-10"
            >
              <Wand2 className="w-4 h-4" />
              Fill Document
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── Results (Phase B results) ─────────────── */
  if (phase === "results" && result) {
    return (
      <div className="stagger-children max-w-[1100px] mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold tracking-tight truncate">{result.documentType}</h2>
              <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-semibold shrink-0">
                {fields.length} field{fields.length === 1 ? "" : "s"} filled
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{result.detectedLayout}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCcw className="w-3.5 h-3.5" />
              New document
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadText(`${baseName}.txt`, docText)} className="gap-1.5 text-xs">
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
              {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
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

        {result.unresolved.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              These fields were left without a value, so they stayed blank:{" "}
              <span className="font-semibold text-foreground">
                {result.unresolved.join(", ")}
              </span>
              . Edit them below, or go back and fill them in.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Editable fields */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="py-3 px-5 border-b border-border/40">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filled fields
              </CardTitle>
              <CardDescription className="text-[11px]">
                From your document&apos;s layout, edit any value
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 max-h-[560px] overflow-y-auto">
              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground/70">
                  No discrete fields detected. See the completed document alongside.
                </p>
              )}
              {fields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    {f.label}
                    {f.wasBlank && (
                      <span className="text-[9px] uppercase text-brand/80 font-semibold">was blank</span>
                    )}
                  </label>
                  <Input
                    value={f.filledValue}
                    onChange={(e) => patchField(f.id, e.target.value)}
                    placeholder="—"
                  />
                  {f.note && <p className="text-[10px] text-muted-foreground/60">{f.note}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Completed document */}
          <Card className="border-brand/30 shadow-sm">
            <CardHeader className="py-3 px-5 border-b border-border/40">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-brand">
                Completed document
              </CardTitle>
              <CardDescription className="text-[11px]">
                Editable, this is what gets downloaded
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                rows={22}
                className="text-xs font-mono leading-relaxed whitespace-pre"
              />
            </CardContent>
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          The AI fills the values you provided and keeps your document&apos;s original layout. Check
          every figure before you send it.
        </p>
      </div>
    );
  }

  /* ─────────────── Upload ─────────────── */
  return (
    <div className="stagger-children max-w-[900px] mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Document Filler</h2>
          <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 mr-1" />
            From your document
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Upload your own invoice, bill, or form (blank or partly filled, PDF/Word/RTF/image) and the
          AI reads its exact layout, shows you every field it found (blanks included), and lets you type
          each value in before filling and downloading it.
        </p>
      </div>

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
              {file ? "Choose a different document" : "Add your invoice / form"}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              PDF, image, Word, RTF, Excel/CSV, or text · up to 16MB · drag &amp; drop or click
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
          onClick={handleDetect}
          disabled={!file}
          className="gap-2 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl px-6 h-10"
        >
          <ScanSearch className="w-4 h-4" />
          Detect fields
        </Button>
        <p className="text-[11px] text-muted-foreground/50">
          {!file ? "Add your document to continue." : "Ready to read the document's fields."}
        </p>
      </div>
    </div>
  );
}
