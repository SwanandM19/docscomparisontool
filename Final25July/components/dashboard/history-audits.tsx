"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  History,
  FileCheck,
  FileWarning,
  FileClock,
  User,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getHistory,
  deleteAuditEntry,
  clearAuditLog,
  ApiClientError,
  type HistoryResponse,
} from "@/lib/api-client";
import { useSession } from "@/lib/hooks/use-session";

type PendingAction =
  | { kind: "deleteEntry"; id: string; label: string }
  | { kind: "clearAll" }
  | null;

const statusConfig = {
  completed: { icon: FileCheck, color: "text-success", bg: "bg-success/10", label: "Completed" },
  warning: { icon: FileWarning, color: "text-warning", bg: "bg-warning/10", label: "Warning" },
  pending: { icon: FileClock, color: "text-brand", bg: "bg-brand/10", label: "Pending" },
};

const PAGE_SIZE = 10;

interface HistoryAuditsProps {
  onViewComparison?: (id: string) => void;
}

export default function HistoryAudits({ onViewComparison }: HistoryAuditsProps) {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(true);

  const [pending, setPending] = useState<PendingAction>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHistory({ page: targetPage, limit: PAGE_SIZE });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const handleConfirm = async () => {
    if (!pending) return;
    setDeleting(true);
    setActionError(null);
    try {
      if (pending.kind === "deleteEntry") {
        await deleteAuditEntry(pending.id);
      } else {
        await clearAuditLog();
        setPage(1);
      }
      setPending(null);
      await load(pending.kind === "clearAll" ? 1 : page);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Action failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const entries = data ? [...data.auditEntries].sort((a, b) => {
    const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return sortDesc ? -diff : diff;
  }) : [];

  return (
    <div className="stagger-children">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">History & Audits</h2>
          <p className="text-muted-foreground mt-1">
            Complete audit trail of all document operations and system events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setActionError(null); setPending({ kind: "clearAll" }); }}
              disabled={!data || data.auditEntries.length === 0}
              className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Log
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => load(page)} className="text-xs gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Comparisons", value: data?.stats.totalComparisons !== undefined ? String(data.stats.totalComparisons) : "—" },
          { label: "Matched", value: data?.stats.matched !== undefined ? String(data.stats.matched) : "—" },
          { label: "Partial / Failed", value: data ? String(data.stats.partial + data.stats.failed) : "—" },
          { label: "Avg Match Score", value: data ? `${data.stats.avgMatchScore}%` : "—" },
        ].map((card) => (
          <div key={card.label} className="group relative bg-card rounded-2xl border border-border/60 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Audit table */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/10">
              <History className="w-4 h-4 text-brand" />
            </div>
            <h3 className="text-sm font-semibold">Audit Log</h3>
          </div>
          <button
            onClick={() => setSortDesc((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" /> {sortDesc ? "Newest First" : "Oldest First"}
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Loading audit log…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Action</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Document</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">User</th>
                    <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Timestamp</th>
                    {isAdmin && <th className="w-12 px-5 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="text-center py-10 text-sm text-muted-foreground">
                        No audit events yet. Run a comparison to populate this log.
                      </td>
                    </tr>
                  )}
                  {entries.map((entry) => {
                    const config = statusConfig[entry.status];
                    const StatusIcon = config.icon;
                    const comparisonId = entry.relatedComparisonId;
                    return (
                      <tr
                        key={entry.id}
                        onClick={comparisonId ? () => onViewComparison?.(comparisonId) : undefined}
                        title={comparisonId ? "View this comparison" : undefined}
                        className={cn(
                          "border-b border-border/30 last:border-0 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors duration-150 group",
                          comparisonId && "cursor-pointer"
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border-0",
                              entry.status === "completed"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                : entry.status === "warning"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                            )}
                          >
                            {config.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="text-sm font-medium">{entry.action}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm">{entry.documentName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center">
                              <User className="w-3 h-3 text-brand" />
                            </div>
                            <span className="text-xs">{entry.user}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActionError(null); setPending({ kind: "deleteEntry", id: entry.id, label: entry.action }); }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all"
                              title="Delete this audit entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-secondary/30">
                <span className="text-xs text-muted-foreground">
                  Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} total events
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="text-xs h-7"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    className="text-xs h-7"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !deleting) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {pending?.kind === "clearAll" ? "Clear entire audit log?" : "Delete this audit entry?"}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "clearAll"
                ? "This permanently deletes every audit log entry. This cannot be undone."
                : `This permanently deletes "${pending?.kind === "deleteEntry" ? pending.label : ""}" from the audit log. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setPending(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={deleting}
              onClick={handleConfirm}
              className="text-xs gap-1.5 bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {pending?.kind === "clearAll" ? "Clear Log" : "Delete Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
