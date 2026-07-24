import type { DocumentFileType } from "@/types/document";

/**
 * Maps a mime type / file extension to our internal FileType, used to route
 * extraction strategy (PDF/image inline-data vs spreadsheet handling) and
 * to drive the frontend's file-type icon/badge.
 */
export function resolveFileType(mimeType: string, fileName: string): DocumentFileType {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (
    ["xlsx", "xls", "csv"].includes(ext) ||
    mimeType.includes("spreadsheet") ||
    mimeType === "text/csv"
  ) {
    return "excel";
  }
  if (
    ["docx", "doc"].includes(ext) ||
    mimeType.includes("wordprocessingml") ||
    mimeType === "application/msword"
  ) {
    return "word";
  }
  return "pdf";
}
