import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const uploadInputSchema = z.object({
  kind: z.enum(["PO", "GRN", "Invoice", "Contract"]),
});

const f = createUploadthing();

/**
 * Single shared uploader used for every document kind. The `kind` (PO / GRN /
 * Invoice / Contract) is supplied by the client as form input and validated
 * server-side in `.input()` below — this determines which comparison slot
 * the resulting Document record belongs to.
 */
export const ourFileRouter = {
  documentUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
    "text/csv": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .input(uploadInputSchema)
    .middleware(async ({ req, input }) => {
      const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
      if (!session) {
        throw new UploadThingError("You must be signed in to upload documents.");
      }
      return { kind: input.kind, uploadedBy: session.email };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      // Intentionally lightweight: the actual Document record is created by
      // the client calling POST /api/upload right after this resolves, which
      // keeps all DB writes behind our own validated, testable route handlers
      // rather than inside third-party webhook callbacks.
      return {
        kind: metadata.kind,
        fileUrl: file.ufsUrl ?? file.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
