"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileText,
  GitCompareArrows,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  BarChart3,
  Shield,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getHistory, ApiClientError, type HistoryResponse } from "@/lib/api-client";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
}

function StatCard({ title, value, icon: Icon, iconColor }: StatCardProps) {
  return (
    <div className="group relative bg-card rounded-2xl border border-border/60 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        </div>
        <Icon className={cn("w-5 h-5 text-muted-foreground/80 shrink-0", iconColor)} />
      </div>
    </div>
  );
}

function RecentComparisonRow({
  mode,
  status,
  matchScore,
  createdAt,
  onClick,
}: {
  mode: string;
  status: string;
  matchScore: number;
  createdAt: string;
  onClick?: () => void;
}) {
  const statusConfig = {
    Matched: { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50", label: "Matched" },
    Partial: { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50", label: "Partial" },
    Failed: { color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-950/50", label: "Failed" },
  } as const;

  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.Partial;

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-4 py-3 px-4 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors duration-150 group w-full text-left cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-foreground">
          {mode.toUpperCase()} Comparison
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border-0", config.bg, config.color)}>
          {config.label}
        </span>
        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-foreground tabular-nums">{matchScore}%</span>
        </div>
      </div>
    </button>
  );
}

interface DashboardOverviewProps {
  onNavigate?: (id: string) => void;
  onViewComparison?: (id: string) => void;
}

export default function DashboardOverview({ onNavigate, onViewComparison }: DashboardOverviewProps) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHistory({ limit: 6 });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats ?? { totalComparisons: 0, matched: 0, partial: 0, failed: 0, avgMatchScore: 0 };
  const recentComparisons = data?.comparisons.slice(0, 6) ?? [];

  const statCards: StatCardProps[] = [
    { title: "Comparisons Run", value: String(stats.totalComparisons), icon: GitCompareArrows, iconColor: "text-violet-500" },
    { title: "Matched", value: String(stats.matched), icon: CheckCircle2, iconColor: "text-emerald-500" },
    { title: "Partial / Failed", value: String(stats.partial + stats.failed), icon: AlertTriangle, iconColor: "text-amber-500" },
    { title: "Avg Match Score", value: `${stats.avgMatchScore}%`, icon: TrendingUp, iconColor: "text-brand" },
  ];

  return (
    <div className="stagger-children">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground mt-1">
            Real-time document intelligence and comparison analytics
          </p>
        </div>
        <button onClick={load} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-7 h-7 text-brand animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertTriangle className="w-7 h-7 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent comparisons */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <div>
                  <h3 className="text-sm font-semibold">Recent Comparisons</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Latest document processing results</p>
                </div>
                <button
                  onClick={() => onNavigate?.("history")}
                  className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
                >
                  View all →
                </button>
              </div>
              <div className="p-2 space-y-0.5">
                {recentComparisons.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    No comparisons yet. Start one from the Document Comparator.
                  </p>
                ) : (
                  recentComparisons.map((c) => (
                    <RecentComparisonRow
                      key={c.id}
                      mode={c.mode}
                      status={c.status}
                      matchScore={c.matchScore}
                      createdAt={c.createdAt}
                      onClick={() => onViewComparison?.(c.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right column — Status breakdown + Quick Actions */}
            <div className="space-y-6">
              <div className="bg-card rounded-2xl border border-border/60 p-6">
                <h3 className="text-sm font-semibold mb-4">Comparison Status Breakdown</h3>
                <div className="space-y-4">
                  {[
                    { label: "Matched", count: stats.matched, color: "bg-success", icon: CheckCircle2 },
                    { label: "Partial", count: stats.partial, color: "bg-warning", icon: AlertTriangle },
                    { label: "Failed", count: stats.failed, color: "bg-destructive", icon: XCircle },
                  ].map((stage) => (
                    <div key={stage.label} className="flex items-center gap-3">
                      <stage.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium">{stage.label}</span>
                          <span className="text-xs text-muted-foreground font-mono">{stage.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-1000", stage.color)}
                            style={{
                              width: `${stats.totalComparisons > 0 ? (stage.count / stats.totalComparisons) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-card rounded-2xl border border-border/60 p-6">
                <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "New Compare", icon: GitCompareArrows, accent: true, pageId: "comparator" },
                    { label: "Upload Docs", icon: FileText, accent: false, pageId: "comparator" },
                    { label: "View Reports", icon: BarChart3, accent: false, pageId: "analytics" },
                    { label: "Audit Trail", icon: Shield, accent: false, pageId: "history" },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => onNavigate?.(action.pageId)}
                      className={cn(
                        "flex flex-col items-center gap-2 py-4 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer",
                        action.accent
                          ? "bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20"
                          : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                      )}
                    >
                      <action.icon className="w-5 h-5" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
