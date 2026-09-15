"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  ScrollText,
  Upload,
  FileText,
  X,
  Loader2,
  AlertTriangle,
  RefreshCcw,
  Sparkles,
  Users,
  CalendarDays,
  IndianRupee,
  ListChecks,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadFiles } from "@/lib/uploadthing/react";
import { summarizeFiles, renderSummaryPdf, ApiClientError } from "@/lib/api-client";
import type { DocumentSummary as DocSummary, LabelledValue } from "@/types/summary";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.rtf,.txt,.csv,.xlsx,.xls";
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const MIN_FILES = 1;
const MAX_FILES = 5;

interface StagedFile {
  id: string;
  file: File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldGrid({ items }: { items: LabelledValue[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border border-border/40 bg-card px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{item.label}</p>
          <p className="text-sm font-medium break-words">{item.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-brand" />
        {title}
      </p>
      {children}
    </div>
  );
}

export default function DocumentSummary() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [phase, setPhase] = useState<"upload" | "running" | "results">("upload");
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DocSummary[] | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    setError(null);
    setStaged((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (next.length >= MAX_FILES) break;
        if (file.size > MAX_FILE_SIZE_BYTES) continue;
        if (next.some((s) => s.file.name === file.name && s.file.size === file.size)) continue;
        next.push({ id: `${file.name}-${file.size}-${Date.now()}-${next.length}`, file });
      }
      return next;
    });
  }, []);

  const removeFile = (id: string) => setStaged((prev) => prev.filter((s) => s.id !== id));

  const reset = () => {
    setStaged([]);
    setResults(null);
    setError(null);
    setProgressLabel("");
    setPdfBusy(false);
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
      setProgressLabel("Reading the document(s) and writing the summary…");
      const { documents } = await summarizeFiles(uploaded);
      setResults(documents);
      setPhase("results");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not summarize the document(s)."
      );
      setPhase("upload");
    }
  };

  const downloadPdf = async () => {
    if (!results) return;
    setPdfBusy(true);
    setError(null);
    try {
      const blob = await renderSummaryPdf(results);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        results.length === 1
          ? `${results[0].fileName.replace(/\.[^.]+$/, "")}-summary.pdf`
          : `document-summaries.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not generate the summary PDF."
      );
    } finally {
      setPdfBusy(false);
    }
  };

  /* ─────────────── Running ─────────────── */
  if (phase === "running") {
    return (
      <div className="max-w-[900px] mx-auto flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
          <ScrollText className="w-7 h-7 text-brand animate-pulse" />
        </div>
        <p className="text-sm font-semibold">Summarizing</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {progressLabel}
        </p>
        <p className="text-[11px] text-muted-foreground/60 max-w-sm">
          The AI reads each document in full and extracts every important detail: parties, reference
          numbers, dates, figures, line items, and anything notable.
        </p>
      </div>
    );
  }

  /* ─────────────── Results ─────────────── */
  if (phase === "results" && results) {
    return (
      <div className="stagger-children max-w-[1100px] mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Document Summary</h2>
            <p className="text-xs text-muted-foreground">
              {results.length} document{results.length > 1 ? "s" : ""} summarized
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 text-xs">
              <RefreshCcw className="w-3.5 h-3.5" />
              New summary
            </Button>
            <Button
              size="sm"
              onClick={downloadPdf}
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

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}

        {results.map((doc, idx) => (
          <Card key={idx} className="border-border/80 shadow-sm">
            <CardHeader className="py-4 px-6 border-b border-border/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">{doc.title}</CardTitle>
                  <CardDescription className="text-[11px] truncate">
                    {doc.fileName}
                  </CardDescription>
                </div>
                <Badge className="ml-auto bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold shrink-0">
                  {doc.documentType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <p className="text-sm leading-relaxed text-foreground/90">{doc.overview}</p>

              {doc.parties.length > 0 && (
                <Section icon={Users} title="Parties">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {doc.parties.map((p, i) => (
                      <div key={i} className="rounded-md border border-border/40 bg-card px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                          {p.role}
                        </p>
                        <p className="text-sm font-medium">{p.name || "—"}</p>
                        {p.details && (
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                            {p.details}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {doc.keyFields.length > 0 && (
                <Section icon={ListChecks} title="Key details">
                  <FieldGrid items={doc.keyFields} />
                </Section>
              )}

              {doc.dates.length > 0 && (
                <Section icon={CalendarDays} title="Dates">
                  <FieldGrid items={doc.dates} />
                </Section>
              )}

              {doc.financials.length > 0 && (
                <Section icon={IndianRupee} title="Financials">
                  <div className="rounded-lg border border-border/50 divide-y divide-border/40">
                    {doc.financials.map((f, i) => (
                      <div key={i} className="flex justify-between gap-4 px-3 py-1.5 text-sm">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-semibold tabular-nums text-right">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {doc.lineItems.length > 0 && (
                <Section icon={ListChecks} title={`Line items (${doc.lineItems.length})`}>
                  <div className="overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/40 text-muted-foreground">
                          <th className="text-left font-semibold px-3 py-2">Description</th>
                          <th className="text-right font-semibold px-3 py-2">Qty</th>
                          <th className="text-right font-semibold px-3 py-2">Unit</th>
                          <th className="text-right font-semibold px-3 py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {doc.lineItems.map((li, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{li.description || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{li.quantity}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{li.unitPrice}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {li.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {doc.highlights.length > 0 && (
                <Section icon={AlertTriangle} title="Highlights">
                  <ul className="space-y-1.5 list-disc pl-4 marker:text-brand text-xs text-muted-foreground">
                    {doc.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </Section>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  /* ─────────────── Upload ─────────────── */
  return (
    <div className="stagger-children max-w-[900px] mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Document Summary</h2>
          <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
            <Sparkles className="w-3 h-3 mr-1" />
            Any document
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Upload at least one document (a PO, invoice, GRN, contract, report, letter, anything) and
          get a detailed structured summary: what it is, who&apos;s involved, every important field
          and figure, line items, dates, and anything that stands out.
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
              {staged.length >= MAX_FILES ? `Maximum ${MAX_FILES} documents` : "Add document(s)"}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              PDF, image, Word, Excel/CSV, or text · up to 16MB each · drag &amp; drop or click
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
                    aria-label="Remove file"
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
        <Button
          onClick={handleRun}
          disabled={staged.length < MIN_FILES}
          className="gap-2 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl px-6 h-10"
        >
          <ScrollText className="w-4 h-4" />
          Summarize {staged.length > 0 ? `${staged.length} document${staged.length > 1 ? "s" : ""}` : ""}
        </Button>
        <p className="text-[11px] text-muted-foreground/50">
          {staged.length < MIN_FILES
            ? "Add at least one document to continue."
            : `${staged.length} document${staged.length > 1 ? "s" : ""} ready.`}
        </p>
      </div>
    </div>
  );
}
