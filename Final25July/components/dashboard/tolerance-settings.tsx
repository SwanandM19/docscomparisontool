"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Settings,
  SlidersHorizontal,
  Plus,
  Trash2,
  Save,
  ToggleLeft,
  ToggleRight,
  Info,
  Shield,
  AlertTriangle,
  Loader2,
  RefreshCcw,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getToleranceRules,
  updateToleranceRules,
  createToleranceRule,
  deleteToleranceRule,
  ApiClientError,
  type ToleranceRuleDto,
} from "@/lib/api-client";

const categoryConfig = {
  pricing: { label: "Pricing", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
  quantity: { label: "Quantity", color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-950/50" },
  dates: { label: "Dates", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50" },
  general: { label: "General", color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/60" },
} as const;

const emptyDraft = {
  field: "",
  type: "percentage" as "percentage" | "absolute",
  value: 1,
  unit: "%",
  enabled: true,
  category: "general" as keyof typeof categoryConfig,
  description: "",
};

export default function ToleranceSettings() {
  const [rules, setRules] = useState<ToleranceRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { rules } = await getToleranceRules();
      setRules(rules);
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : "Failed to load tolerance rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setDirty(true);
  };

  const updateRuleValue = (id: string, value: number) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { rules: updated } = await updateToleranceRules(rules);
      setRules(updated);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteToleranceRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : "Failed to delete rule.");
    }
  };

  const handleCreate = async () => {
    if (!draft.field.trim()) return;
    setCreating(true);
    setSaveError(null);
    try {
      const { rule } = await createToleranceRule(draft);
      setRules((prev) => [...prev, rule]);
      setDraft(emptyDraft);
      setShowAddForm(false);
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : "Failed to create rule.");
    } finally {
      setCreating(false);
    }
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-sm text-muted-foreground">Loading tolerance rules…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive font-medium">{loadError}</p>
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
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tolerance Rules</h2>
          <p className="text-muted-foreground mt-1">
            Configure comparison thresholds for document field matching
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {saveError && <p className="text-xs text-destructive mr-2">{saveError}</p>}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowAddForm((v) => !v)}>
            <Plus className="w-3.5 h-3.5" /> Add Rule
          </Button>
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={handleSave}
            className="text-xs gap-1.5 bg-brand hover:bg-brand/90 text-brand-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Add rule form */}
      {showAddForm && (
        <div className="mb-8 p-5 rounded-xl border border-brand/20 bg-brand/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">New Tolerance Rule</h3>
            <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              placeholder="Field name (e.g. Freight Charge)"
              value={draft.field}
              onChange={(e) => setDraft((d) => ({ ...d, field: e.target.value }))}
              className="bg-card"
            />
            <Select value={draft.type} onValueChange={(v) => setDraft((d) => ({ ...d, type: v as "percentage" | "absolute" }))}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="absolute">Absolute</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Value"
              value={draft.value}
              onChange={(e) => setDraft((d) => ({ ...d, value: Number(e.target.value) }))}
              className="bg-card"
            />
            <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: v as keyof typeof categoryConfig }))}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pricing">Pricing</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="dates">Dates</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Unit (e.g. %, units, days, USD)"
              value={draft.unit}
              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
              className="bg-card max-w-[200px]"
            />
            <Input
              placeholder="Description"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="bg-card flex-1"
            />
            <Button size="sm" disabled={!draft.field.trim() || creating} onClick={handleCreate} className="gap-1.5">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </Button>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-brand/5 border border-brand/15 mb-8">
        <Info className="w-5 h-5 text-brand shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">How Tolerance Rules Work</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Tolerance rules define acceptable variation thresholds for document
            comparisons. When a field difference falls within the configured
            tolerance, it will be marked as acceptable. Values exceeding the
            threshold will trigger discrepancy alerts. These rules are applied by
            the comparison engine and can be overridden per-comparison from the
            Document Comparator's tolerance slider.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Rules", value: String(rules.length), icon: SlidersHorizontal, color: "text-brand" },
          { label: "Active Rules", value: String(enabledCount), icon: Shield, color: "text-emerald-500" },
          { label: "Disabled Rules", value: String(rules.length - enabledCount), icon: AlertTriangle, color: "text-amber-500" },
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

      {/* Rules list */}
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/10">
              <Settings className="w-4 h-4 text-brand" />
            </div>
            <h3 className="text-sm font-semibold">Configured Rules</h3>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {rules.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">No tolerance rules configured yet.</p>
          )}
          {rules.map((rule) => {
            const catConfig = categoryConfig[rule.category];
            return (
              <div
                key={rule.id}
                className={cn(
                  "flex items-center gap-5 px-5 py-4 transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40",
                  !rule.enabled && "opacity-50"
                )}
              >
                <button onClick={() => toggleRule(rule.id)} className="shrink-0">
                  {rule.enabled ? (
                    <ToggleRight className="w-8 h-8 text-brand" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold">{rule.field}</p>
                    <Badge variant="secondary" className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold border-0", catConfig.bg, catConfig.color)}>
                      {catConfig.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                </div>

                <div className="shrink-0 text-right flex items-center gap-2">
                  <Input
                    type="number"
                    value={rule.value}
                    onChange={(e) => updateRuleValue(rule.id, Number(e.target.value))}
                    className="w-20 h-8 text-right font-bold tabular-nums bg-secondary/40"
                  />
                  <span className="text-xs text-muted-foreground font-medium w-10">{rule.unit}</span>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
