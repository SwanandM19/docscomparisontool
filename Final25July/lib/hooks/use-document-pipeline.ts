"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing/react";
import { registerUpload, extractDocument, ApiClientError } from "@/lib/api-client";
import { useProcessingRegistry } from "@/lib/hooks/processing-registry";
import type { DocumentKind, DocumentFileType, ExtractedDocumentData } from "@/types/document";

export type PipelinePhase = "idle" | "uploading" | "extracting" | "schema" | "complete" | "error";

export interface StagedFileInfo {
  name: string;
  size: string;
  type: DocumentFileType;
  pages?: number;
}

export interface PipelineState {
  phase: PipelinePhase;
  progress: number; // 0-100 overall
  confidence: number; // 0-100, from AI extraction
  file: StagedFileInfo | null;
  isDragOver: boolean;
  documentId: string | null;
  extractedData: ExtractedDocumentData | null;
  error: string | null;
}

const initialState: PipelineState = {
  phase: "idle",
  progress: 0,
  confidence: 0,
  file: null,
  isDragOver: false,
  documentId: null,
  extractedData: null,
  error: null,
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeFromMime(mime: string, name: string): DocumentFileType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (["docx", "doc"].includes(ext) || mime.includes("wordprocessingml") || mime === "application/msword") {
    return "word";
  }
  return "excel";
}

/**
 * Drives a real file through: UploadThing upload -> POST /api/upload
 * (register Document record) -> POST /api/extract (Gemini extraction).
 * Exposes the same phase/progress/confidence shape the UI previously
 * derived from a fake timer, so the existing dropzone visuals keep working
 * unchanged.
 */
export function useDocumentPipeline(kind: DocumentKind) {
  const [state, setState] = useState<PipelineState>(initialState);
  const cancelledRef = useRef(false);
  const jobId = useId();
  const registry = useProcessingRegistry();

  // Mirror this pipeline's in-flight status into the shared registry so the
  // sidebar's "AI Processing" widget can show real counts/progress instead
  // of static placeholder text. Cleared once idle/complete/error, and on
  // unmount.
  useEffect(() => {
    if (!registry) return;
    const isActive = state.phase !== "idle" && state.phase !== "complete" && state.phase !== "error";
    registry.setJob(jobId, isActive ? { label: state.file?.name ?? kind, phase: state.phase, progress: state.progress } : null);
  }, [registry, jobId, kind, state.phase, state.progress, state.file?.name]);

  useEffect(() => {
    return () => registry?.setJob(jobId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const { startUpload: startUploadThing } = useUploadThing("documentUploader", {
    onUploadProgress: (progress) => {
      // Upload accounts for the first 35% of the overall bar.
      setState((prev) => (prev.phase === "uploading" ? { ...prev, progress: Math.round((progress / 100) * 35) } : prev));
    },
  });

  const startUpload = useCallback(
    async (file: File) => {
      cancelledRef.current = false;

      setState({
        ...initialState,
        phase: "uploading",
        progress: 1,
        file: {
          name: file.name,
          size: formatSize(file.size),
          type: fileTypeFromMime(file.type, file.name),
        },
      });

      try {
        const uploadResult = await startUploadThing([file], { kind });
        if (cancelledRef.current) return;

        const serverData = uploadResult?.[0]?.serverData;
        if (!serverData) {
          throw new Error("Upload completed but no server data was returned.");
        }

        setState((prev) => ({ ...prev, progress: 35 }));

        const registered = await registerUpload({
          kind: serverData.kind,
          fileUrl: serverData.fileUrl,
          fileName: serverData.fileName,
          fileSize: serverData.fileSize,
          mimeType: serverData.mimeType,
        });
        if (cancelledRef.current) return;

        setState((prev) => ({
          ...prev,
          phase: "extracting",
          progress: 45,
          documentId: registered.documentId,
        }));

        const extracted = await extractDocument(registered.documentId);
        if (cancelledRef.current) return;

        setState((prev) => ({
          ...prev,
          phase: "schema",
          progress: 90,
          confidence: extracted.extractionConfidence,
          extractedData: extracted.extractedData,
        }));

        // Brief pause so the "Generating Structured Schema" phase is visible
        // rather than flashing instantly — matches the original UX pacing.
        await new Promise((r) => setTimeout(r, 400));
        if (cancelledRef.current) return;

        setState((prev) => ({ ...prev, phase: "complete", progress: 100 }));
      } catch (err) {
        if (cancelledRef.current) return;
        const message =
          err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Upload failed.";
        setState((prev) => ({ ...prev, phase: "error", error: message }));
      }
    },
    [kind, startUploadThing]
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setState(initialState);
  }, []);

  const setDragOver = useCallback((over: boolean) => {
    setState((prev) => ({ ...prev, isDragOver: over }));
  }, []);

  return { state, startUpload, reset, setDragOver };
}
