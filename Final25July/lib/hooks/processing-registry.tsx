"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface ProcessingJob {
  label: string;
  phase: string;
  progress: number;
}

interface ProcessingRegistryValue {
  jobs: Record<string, ProcessingJob>;
  setJob: (id: string, job: ProcessingJob | null) => void;
}

const ProcessingRegistryContext = createContext<ProcessingRegistryValue | null>(null);

/**
 * Wraps the dashboard so any in-flight document pipeline (upload/extract),
 * wherever it's mounted, can report its status to the sidebar's "AI
 * Processing" widget without prop-drilling through the page tree.
 */
export function ProcessingRegistryProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Record<string, ProcessingJob>>({});

  const setJob = useCallback((id: string, job: ProcessingJob | null) => {
    setJobs((prev) => {
      if (job === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      const existing = prev[id];
      if (existing && existing.phase === job.phase && existing.progress === job.progress && existing.label === job.label) {
        return prev;
      }
      return { ...prev, [id]: job };
    });
  }, []);

  const value = useMemo(() => ({ jobs, setJob }), [jobs, setJob]);

  return <ProcessingRegistryContext.Provider value={value}>{children}</ProcessingRegistryContext.Provider>;
}

/**
 * Returns null (rather than throwing) when used outside a provider, so
 * `useDocumentPipeline` can call this defensively from anywhere.
 */
export function useProcessingRegistry(): ProcessingRegistryValue | null {
  return useContext(ProcessingRegistryContext);
}
