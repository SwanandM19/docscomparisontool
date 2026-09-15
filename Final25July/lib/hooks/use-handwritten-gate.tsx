"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { PenLine, ScanText, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type GateStep = "handwritten" | "readable" | "warning";

interface PendingFile {
  file: File;
  resolve: (proceed: boolean) => void;
}

interface HandwrittenGateContextValue {
  /**
   * Runs each file through the "is this handwritten?" / readability check
   * before the caller's normal upload/staging logic ever sees it. Resolves
   * with only the files the user was allowed (or chose) to proceed with —
   * existing processing pipelines are untouched, this just gates entry.
   */
  gateFiles: (files: File[]) => Promise<File[]>;
}

const HandwrittenGateContext = createContext<HandwrittenGateContextValue | null>(null);

/**
 * Mounted once near the root of the dashboard (see app/dashboard/page.tsx) so
 * every upload entry point across the app shares one consistent modal flow
 * instead of each screen re-implementing it.
 */
export function HandwrittenGateProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PendingFile[]>([]);
  const [step, setStep] = useState<GateStep>("handwritten");
  const current = queue[0] ?? null;

  const enqueue = useCallback((file: File) => {
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, { file, resolve }]);
    });
  }, []);

  const gateFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return [];
      const decisions = await Promise.all(files.map((file) => enqueue(file)));
      return files.filter((_, i) => decisions[i]);
    },
    [enqueue]
  );

  const settle = useCallback((proceed: boolean) => {
    setQueue((prev) => {
      prev[0]?.resolve(proceed);
      return prev.slice(1);
    });
    setStep("handwritten");
  }, []);

  return (
    <HandwrittenGateContext.Provider value={{ gateFiles }}>
      {children}

      <Dialog
        open={current !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {step === "handwritten" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-brand" />
                  Is this document handwritten?
                </DialogTitle>
                <DialogDescription className="truncate">{current?.file.name}</DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Let us know so we can flag documents that may need extra care when reading
                handwriting before processing continues.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => settle(true)}>
                  No
                </Button>
                <Button onClick={() => setStep("readable")} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                  Yes
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "readable" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScanText className="w-4 h-4 text-brand" />
                  Is the handwriting clearly readable?
                </DialogTitle>
                <DialogDescription className="truncate">{current?.file.name}</DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This helps set expectations for extraction accuracy on handwritten content.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("warning")}>
                  No, it&apos;s not readable
                </Button>
                <Button onClick={() => settle(true)} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                  Yes, it&apos;s readable
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "warning" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Accuracy may be affected
                </DialogTitle>
                <DialogDescription className="truncate">{current?.file.name}</DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This document may be difficult to process accurately because it is not
                sufficiently readable. You can still continue, but the accuracy of the generated
                result may be affected.
              </p>
              <DialogFooter>
                <Button onClick={() => settle(true)} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </HandwrittenGateContext.Provider>
  );
}

export function useHandwrittenGate(): HandwrittenGateContextValue {
  const ctx = useContext(HandwrittenGateContext);
  if (!ctx) {
    throw new Error("useHandwrittenGate must be used within a HandwrittenGateProvider");
  }
  return ctx;
}
