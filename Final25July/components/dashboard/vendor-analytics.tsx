"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  Building2,
  Star,
  AlertTriangle,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getHistory, ApiClientError, type HistoryResponse } from "@/lib/api-client";

const statusConfig = {
  excellent: { label: "Excellent", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
  good: { label: "Good", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50" },
  "needs-attention": { label: "Needs Attention", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-950/50" },
} as const;

function ratingFromAccuracy(accuracy: number): number {
  if (accuracy >= 99) return 5;
  if (accuracy >= 95) return 4;
  if (accuracy >= 90) return 3;
  if (accuracy >= 80) return 2;
  return 1;
}

export default function VendorAnalytics() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHistory({ limit: 100 });
      setData(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load vendor analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const vendors = data?.vendors ?? [];
  const avgAccuracy = vendors.length > 0 ? vendors.reduce((s, v) => s + v.accuracy, 0) / vendors.length : 0;
  const totalDocs = vendors.reduce((s, v) => s + v.totalDocs, 0);
  const openIssues = vendors.reduce((s, v) => s + v.discrepancies, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-sm text-muted-foreground">Loading vendor analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCcw className="w-3.5 h-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="stagger-children">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Performance metrics and accuracy tracking, derived from your comparison history
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="text-xs gap-1.5">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Vendors", value: String(vendors.length), icon: Building2, color: "text-muted-foreground/80" },
          { label: "Avg Accuracy", value: `${avgAccuracy.toFixed(1)}%`, icon: TrendingUp, color: "text-muted-foreground/80" },
          { label: "Total Documents", value: totalDocs.toLocaleString(), icon: BarChart3, color: "text-muted-foreground/80" },
          { label: "Open Issues", value: String(openIssues), icon: AlertTriangle, color: "text-muted-foreground/80" },
        ].map((card) => (
          <div key={card.label} className="group relative bg-card rounded-2xl border border-border/60 p-6 hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">{card.value}</p>
              </div>
              <card.icon className={cn("w-5 h-5 shrink-0", card.color)} />
            </div>
          </div>
        ))}
      </div>

      {/* Vendor cards grid */}
      {vendors.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No vendor data yet. Vendor performance is derived automatically once you run comparisons.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vendors.map((vendor) => {
            const config = statusConfig[vendor.status as keyof typeof statusConfig] ?? statusConfig.good;
            const rating = ratingFromAccuracy(vendor.accuracy);
            return (
              <div key={vendor.name} className="bg-card rounded-2xl border border-border/60 p-6 hover:shadow-md transition-all duration-300 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{vendor.name}</p>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("w-3 h-3", i < rating ? "text-warning fill-warning" : "text-muted")} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Accuracy Rate</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          vendor.accuracy >= 98 ? "bg-success" : vendor.accuracy >= 95 ? "bg-brand" : "bg-warning"
                        )}
                        style={{ width: `${Math.min(100, vendor.accuracy)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums">{vendor.accuracy}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-sm font-bold">{vendor.totalDocs.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Documents</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">{vendor.discrepancies}</p>
                    <p className="text-[10px] text-muted-foreground">Discrepancies</p>
                  </div>
                  <Badge variant="secondary" className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold border-0", config.bg, config.color)}>
                    {config.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
