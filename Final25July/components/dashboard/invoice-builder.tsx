"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReceiptText,
  Plus,
  Trash2,
  Download,
  Share2,
  Save,
  Loader2,
  AlertTriangle,
  Check,
  FolderOpen,
  FileText,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { calculateInvoice, lineAmount, formatAmount } from "@/lib/invoice/calculate";
import {
  createInvoice,
  updateInvoice,
  getInvoices,
  deleteInvoice,
  renderInvoicePdf,
  ApiClientError,
} from "@/lib/api-client";
import {
  TAX_MODE_LABELS,
  type InvoiceData,
  type InvoiceLineItem,
  type InvoiceParty,
  type InvoiceRecord,
  type InvoiceTaxMode,
} from "@/types/invoice";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
const TAX_MODES: InvoiceTaxMode[] = ["cgst_sgst", "igst", "none"];
const COMMON_TAX_RATES = [0, 5, 12, 18, 28];

function newLineItem(): InvoiceLineItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    hsn: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 18,
  };
}

function emptyParty(): InvoiceParty {
  return { name: "", address: "", gstin: "", email: "", phone: "" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A reasonable starting invoice number, e.g. INV-2026-0042. */
function suggestInvoiceNumber(): string {
  const now = new Date();
  const seq = String(Math.floor(now.getTime() / 1000) % 10000).padStart(4, "0");
  return `INV-${now.getFullYear()}-${seq}`;
}

function blankInvoice(): InvoiceData {
  return {
    invoiceNumber: suggestInvoiceNumber(),
    invoiceDate: todayIso(),
    dueDate: "",
    currency: "INR",
    taxMode: "cgst_sgst",
    seller: emptyParty(),
    buyer: emptyParty(),
    lineItems: [newLineItem()],
    discount: 0,
    shipping: 0,
    notes: "",
    terms: "Payment due within 30 days of the invoice date.",
  };
}

/** Labelled field wrapper so every input in the form lines up the same way. */
function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[11px] font-medium text-muted-foreground block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
    </div>
  );
}

function PartyFields({
  party,
  onChange,
}: {
  party: InvoiceParty;
  onChange: (patch: Partial<InvoiceParty>) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Name">
        <Input
          value={party.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Business or person"
        />
      </Field>
      <Field label="Address">
        <Textarea
          value={party.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder={"Street\nCity, State PIN"}
          rows={3}
          className="text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="GSTIN">
          <Input
            value={party.gstin}
            onChange={(e) => onChange({ gstin: e.target.value.toUpperCase() })}
            placeholder="27ABCDE1234F1Z5"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={party.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+91 98765 43210"
          />
        </Field>
      </div>
      <Field label="Email">
        <Input
          type="email"
          value={party.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="billing@example.com"
        />
      </Field>
    </div>
  );
}

export default function InvoiceBuilder() {
  const [data, setData] = useState<InvoiceData>(blankInvoice);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "download" | "share">(null);

  const [showSaved, setShowSaved] = useState(false);
  const [saved, setSaved] = useState<InvoiceRecord[] | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const totals = useMemo(() => calculateInvoice(data), [data]);

  // Transient confirmations ("Saved", "Shared") clear themselves.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const patch = useCallback((update: Partial<InvoiceData>) => {
    setData((prev) => ({ ...prev, ...update }));
  }, []);

  const patchItem = useCallback((id: string, update: Partial<InvoiceLineItem>) => {
    setData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) => (item.id === id ? { ...item, ...update } : item)),
    }));
  }, []);

  const addItem = () =>
    setData((prev) => ({ ...prev, lineItems: [...prev.lineItems, newLineItem()] }));

  const removeItem = (id: string) =>
    setData((prev) => ({
      ...prev,
      // Always keep at least one row so the table never collapses to nothing.
      lineItems:
        prev.lineItems.length > 1
          ? prev.lineItems.filter((item) => item.id !== id)
          : prev.lineItems,
    }));

  /** Validates the few fields the server also insists on, for a faster message. */
  const validate = (): string | null => {
    if (!data.invoiceNumber.trim()) return "Give the invoice a number before saving or sharing.";
    if (data.lineItems.length === 0) return "Add at least one line item.";
    if (data.lineItems.every((i) => !i.description.trim()))
      return "Describe at least one line item.";
    return null;
  };

  const buildPdfBlob = async (): Promise<Blob> => renderInvoicePdf(data);

  const fileName = `invoice-${(data.invoiceNumber || "draft").replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`;

  const handleDownload = async () => {
    const invalid = validate();
    if (invalid) return setError(invalid);
    setError(null);
    setBusy("download");
    try {
      const blob = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setNotice("Invoice downloaded.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not generate the PDF.");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    const invalid = validate();
    if (invalid) return setError(invalid);
    setError(null);
    setBusy("share");
    try {
      const blob = await buildPdfBlob();
      const pdfFile = new File([blob], fileName, { type: "application/pdf" });

      // Web Share with file attachments is only available on secure origins
      // and mostly on mobile — fall back to a download everywhere else.
      const canShareFile =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [pdfFile] });

      if (canShareFile) {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice ${data.invoiceNumber}`,
          text: `Invoice ${data.invoiceNumber}${
            data.seller.name ? ` from ${data.seller.name}` : ""
          } — ${formatAmount(totals.grandTotal, data.currency)}`,
        });
        setNotice("Invoice shared.");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setNotice("Sharing isn't available in this browser — the PDF was downloaded instead.");
      }
    } catch (err) {
      // The user dismissing the share sheet throws AbortError; that's not an error.
      if (err instanceof DOMException && err.name === "AbortError") {
        setBusy(null);
        return;
      }
      setError(err instanceof ApiClientError ? err.message : "Could not share the invoice.");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    const invalid = validate();
    if (invalid) return setError(invalid);
    setError(null);
    setBusy("save");
    try {
      const record = savedId
        ? await updateInvoice(savedId, { data, status: "final" })
        : await createInvoice({ data, status: "final" });
      setSavedId(record._id);
      setSaved(null); // saved list is now stale
      setNotice(savedId ? "Invoice updated." : "Invoice saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the invoice.");
    } finally {
      setBusy(null);
    }
  };

  const loadSavedList = async () => {
    setLoadingSaved(true);
    try {
      const { invoices } = await getInvoices();
      setSaved(invoices);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load saved invoices.");
    } finally {
      setLoadingSaved(false);
    }
  };

  const toggleSavedPanel = () => {
    const next = !showSaved;
    setShowSaved(next);
    if (next && saved === null) void loadSavedList();
  };

  const openSaved = (record: InvoiceRecord) => {
    setData(record.data);
    setSavedId(record._id);
    setShowSaved(false);
    setError(null);
    setNotice(`Loaded invoice ${record.data.invoiceNumber}.`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice(id);
      setSaved((prev) => prev?.filter((r) => r._id !== id) ?? null);
      if (savedId === id) setSavedId(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete the invoice.");
    }
  };

  const startNew = () => {
    setData(blankInvoice());
    setSavedId(null);
    setError(null);
    setNotice("Started a new invoice.");
  };

  return (
    <div className="stagger-children max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight">Invoice Builder</h2>
            <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] font-semibold">
              <Sparkles className="w-3 h-3 mr-1" />
              Template
            </Badge>
            {savedId && (
              <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-semibold">
                Saved
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Fill in the fields and download, share, or save the finished invoice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSavedPanel} className="gap-1.5 text-xs">
            <FolderOpen className="w-3.5 h-3.5" />
            Saved invoices
          </Button>
          <Button variant="outline" size="sm" onClick={startNew} className="gap-1.5 text-xs">
            <RefreshCcw className="w-3.5 h-3.5" />
            New
          </Button>
        </div>
      </div>

      {/* Saved invoices panel */}
      {showSaved && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Saved invoices</CardTitle>
            <CardDescription className="text-xs">
              Open one to keep editing, or remove it
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loadingSaved ? (
              <p className="text-xs text-muted-foreground flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </p>
            ) : saved && saved.length > 0 ? (
              <div className="space-y-2">
                {saved.map((record) => (
                  <div
                    key={record._id}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
                  >
                    <FileText className="w-4 h-4 text-brand shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {record.data.invoiceNumber}
                        {record.data.buyer.name ? ` · ${record.data.buyer.name}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatAmount(record.totals.grandTotal, record.data.currency)} ·{" "}
                        {new Date(record.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => openSaved(record)}
                      className="text-[11px]"
                    >
                      Open
                    </Button>
                    <button
                      onClick={() => handleDelete(record._id)}
                      aria-label="Delete invoice"
                      className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/70 text-center py-4">
                Nothing saved yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice meta */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-brand" />
            Invoice details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Invoice number">
              <Input
                value={data.invoiceNumber}
                onChange={(e) => patch({ invoiceNumber: e.target.value })}
                placeholder="INV-2026-0001"
              />
            </Field>
            <Field label="Invoice date">
              <Input
                type="date"
                value={data.invoiceDate}
                onChange={(e) => patch({ invoiceDate: e.target.value })}
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={data.dueDate}
                onChange={(e) => patch({ dueDate: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <div className="flex flex-wrap gap-1.5">
                {CURRENCIES.map((code) => (
                  <button
                    key={code}
                    onClick={() => patch({ currency: code })}
                    aria-pressed={data.currency === code}
                    className={cn(
                      "px-2.5 h-8 rounded-lg border text-xs font-medium transition-colors",
                      data.currency === code
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border/60 text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Separator className="my-5" />

          <Field label="Tax treatment" hint="Applies to every line item on this invoice.">
            <div className="flex flex-wrap gap-2">
              {TAX_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => patch({ taxMode: mode })}
                  aria-pressed={data.taxMode === mode}
                  className={cn(
                    "px-3 h-9 rounded-lg border text-xs font-medium transition-colors",
                    data.taxMode === mode
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border/60 text-muted-foreground hover:bg-secondary/40"
                  )}
                >
                  {TAX_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Parties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">From</CardTitle>
            <CardDescription className="text-xs">Your business details</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <PartyFields
              party={data.seller}
              onChange={(update) => patch({ seller: { ...data.seller, ...update } })}
            />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Bill to</CardTitle>
            <CardDescription className="text-xs">Who is being invoiced</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <PartyFields
              party={data.buyer}
              onChange={(update) => patch({ buyer: { ...data.buyer, ...update } })}
            />
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">Line items</CardTitle>
          <CardDescription className="text-xs">
            Amounts are calculated as quantity × rate
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {/* Column headers — hidden on small screens where rows stack */}
          <div className="hidden lg:grid grid-cols-[1fr_110px_80px_120px_100px_110px_32px] gap-2 px-1">
            {["Description", "HSN/SAC", "Qty", "Rate", "Tax %", "Amount", ""].map((label, i) => (
              <span
                key={i}
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70",
                  i >= 2 && i <= 5 && "text-right"
                )}
              >
                {label}
              </span>
            ))}
          </div>

          {data.lineItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 lg:grid-cols-[1fr_110px_80px_120px_100px_110px_32px] gap-2 items-center rounded-lg border border-border/40 lg:border-0 p-3 lg:p-0"
            >
              <Input
                value={item.description}
                onChange={(e) => patchItem(item.id, { description: e.target.value })}
                placeholder="Item or service description"
              />
              <Input
                value={item.hsn}
                onChange={(e) => patchItem(item.id, { hsn: e.target.value })}
                placeholder="HSN"
              />
              <Input
                type="number"
                min={0}
                step="any"
                value={item.quantity}
                onChange={(e) => patchItem(item.id, { quantity: Number(e.target.value) || 0 })}
                className="text-right"
              />
              <Input
                type="number"
                min={0}
                step="any"
                value={item.unitPrice}
                onChange={(e) => patchItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                className="text-right"
              />
              <Input
                type="number"
                min={0}
                max={100}
                step="any"
                list="invoice-tax-rates"
                disabled={data.taxMode === "none"}
                value={item.taxRate}
                onChange={(e) => patchItem(item.id, { taxRate: Number(e.target.value) || 0 })}
                className="text-right"
              />
              <div className="text-right text-sm font-semibold tabular-nums px-1">
                {formatAmount(lineAmount(item), data.currency)}
              </div>
              <button
                onClick={() => removeItem(item.id)}
                disabled={data.lineItems.length === 1}
                aria-label="Remove line item"
                className="justify-self-end text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-30 disabled:cursor-not-allowed p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <datalist id="invoice-tax-rates">
            {COMMON_TAX_RATES.map((rate) => (
              <option key={rate} value={rate} />
            ))}
          </datalist>

          <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs mt-1">
            <Plus className="w-3.5 h-3.5" />
            Add line item
          </Button>
        </CardContent>
      </Card>

      {/* Totals + notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Notes &amp; terms</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <Field label="Notes">
              <Textarea
                value={data.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Bank details, payment reference, thanks…"
                rows={3}
                className="text-sm"
              />
            </Field>
            <Field label="Terms & conditions">
              <Textarea
                value={data.terms}
                onChange={(e) => patch({ terms: e.target.value })}
                rows={3}
                className="text-sm"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-brand/30 shadow-sm">
          <CardHeader className="py-4 px-6 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={data.discount}
                  onChange={(e) => patch({ discount: Number(e.target.value) || 0 })}
                  className="text-right"
                />
              </Field>
              <Field label="Shipping / other">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={data.shipping}
                  onChange={(e) => patch({ shipping: Number(e.target.value) || 0 })}
                  className="text-right"
                />
              </Field>
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {formatAmount(totals.subtotal, data.currency)}
                </span>
              </div>
              {totals.discount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium tabular-nums text-success">
                      − {formatAmount(totals.discount, data.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxable value</span>
                    <span className="font-medium tabular-nums">
                      {formatAmount(totals.taxableValue, data.currency)}
                    </span>
                  </div>
                </>
              )}
              {totals.taxLines.map((line, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="font-medium tabular-nums">
                    {formatAmount(line.amount, data.currency)}
                  </span>
                </div>
              ))}
              {totals.shipping > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping / other</span>
                  <span className="font-medium tabular-nums">
                    {formatAmount(totals.shipping, data.currency)}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold">Total due</span>
              <span className="text-xl font-bold tabular-nums text-brand">
                {formatAmount(totals.grandTotal, data.currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5 justify-center">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
      {notice && (
        <p className="text-xs text-success flex items-center gap-1.5 justify-center">
          <Check className="w-3.5 h-3.5" />
          {notice}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2 pb-4">
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={busy !== null}
          className="gap-1.5 text-xs"
        >
          {busy === "save" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {savedId ? "Update saved invoice" : "Save invoice"}
        </Button>
        <Button
          variant="outline"
          onClick={handleShare}
          disabled={busy !== null}
          className="gap-1.5 text-xs"
        >
          {busy === "share" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          Share
        </Button>
        <Button
          onClick={handleDownload}
          disabled={busy !== null}
          className="gap-2 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl px-6 h-10"
        >
          {busy === "download" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download PDF
        </Button>
      </div>
    </div>
  );
}
