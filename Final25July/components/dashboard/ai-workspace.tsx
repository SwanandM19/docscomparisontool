"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Sparkles,
  Bot,
  User,
  Send,
  CornerDownLeft,
  Eye,
  Database,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCcw,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getComparison,
  sendChatMessage,
  ApiClientError,
  type ComparisonDetailResponse,
} from "@/lib/api-client";
import type { ChatMessageRecord } from "@/types/comparison";

interface AIWorkspaceProps {
  comparisonId: string;
  onBack: () => void;
}

const SUGGESTIONS = [
  "What is the single biggest discrepancy here?",
  "Summarize the tax and pricing differences",
  "Draft an exception email to the vendor",
];

export default function AIWorkspace({ comparisonId, onBack }: AIWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"json" | "preview">("preview");
  const [comparison, setComparison] = useState<ComparisonDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getComparison(comparisonId);
      setComparison(data);
      setMessages(
        data.chatHistory.length > 0
          ? data.chatHistory
          : [
              {
                id: "welcome",
                sender: "ai",
                text: `Hello! I've indexed ${data.documents.length} document${data.documents.length > 1 ? "s" : ""} (${data.documentKinds.join(", ")}) for this comparison. Ask me about specific discrepancies, tax details, or have me draft a vendor email.`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]
      );
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [comparisonId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || !comparison) return;

    const userMsg: ChatMessageRecord = {
      id: `local-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await sendChatMessage(comparison._id, textToSend);
      setMessages((prev) => [...prev, result.message]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "ai",
          text:
            err instanceof ApiClientError
              ? `Sorry, I couldn't process that: ${err.message}`
              : "Sorry, something went wrong answering that. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const copyJson = () => {
    if (!comparison) return;
    const payload = comparison.documents.map((d) => ({ kind: d.kind, fileName: d.fileName, ...d.extractedData }));
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-sm text-muted-foreground">Loading AI workspace…</p>
      </div>
    );
  }

  if (loadError || !comparison) {
    return (
      <div className="max-w-[1440px] mx-auto flex flex-col items-center justify-center py-32 gap-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive font-medium">{loadError ?? "Workspace unavailable."}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCcw className="w-3.5 h-3.5" />
            Retry
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto h-[calc(100vh-10rem)] flex flex-col space-y-4">
      {/* Back button header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Comparison Results
        </button>
        <Badge variant="outline" className="text-xs py-1 bg-brand/5 text-brand border-brand/25 font-semibold">
          <Sparkles className="w-3.5 h-3.5 mr-1 text-brand animate-pulse" />
          Grounded AI Workspace
        </Badge>
      </div>

      {/* Main Splitscreen Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* LEFT PANEL: Document Viewers (structured summary & JSON) */}
        <div className="lg:col-span-7 flex flex-col h-full bg-card rounded-xl border border-border/80 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "json" | "preview")}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-border/60">
              <TabsList className="bg-muted p-0.5 h-8">
                <TabsTrigger value="preview" className="text-xs h-7 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Document Summary
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs h-7 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Extracted JSON
                </TabsTrigger>
              </TabsList>
              <Separator orientation="vertical" className="h-4" />
              <Badge variant="secondary" className="text-[10px] font-mono">
                {comparison.mode.toUpperCase()}
              </Badge>
            </div>

            {/* TAB CONTENT: Structured document summary (real extracted data) */}
            <TabsContent value="preview" className="flex-1 overflow-y-auto p-6 bg-secondary/15 focus:outline-none space-y-5">
              {comparison.documents.map((doc) => (
                <div key={doc._id} className="max-w-[700px] mx-auto bg-white dark:bg-zinc-950 p-6 rounded-lg shadow-sm border border-border/60 font-sans text-xs text-foreground space-y-4">
                  <div className="flex items-start justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand" />
                      <div>
                        <h2 className="text-sm font-bold text-foreground">{doc.kind}</h2>
                        <p className="text-[10px] text-muted-foreground">{doc.fileName}</p>
                      </div>
                    </div>
                    {doc.extractionConfidence != null && (
                      <Badge variant="secondary" className="text-[9px] font-mono">
                        {doc.extractionConfidence}% confidence
                      </Badge>
                    )}
                  </div>

                  {doc.extractedData ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-[10px]">
                        <div><span className="text-muted-foreground">Vendor:</span> <span className="font-semibold">{doc.extractedData.vendorName ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-semibold">{doc.extractedData.vendorGSTIN ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold">{doc.extractedData.documentDate ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">Currency:</span> <span className="font-semibold">{doc.extractedData.currency ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">PO #:</span> <span className="font-semibold">{doc.extractedData.poNumber ?? "—"}</span></div>
                        <div><span className="text-muted-foreground">Invoice #:</span> <span className="font-semibold">{doc.extractedData.invoiceNumber ?? "—"}</span></div>
                      </div>

                      {doc.extractedData.lineItems.length > 0 && (
                        <div className="border border-border rounded-lg overflow-hidden mt-2">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-secondary/40 border-b border-border font-semibold text-[10px] text-muted-foreground">
                                <th className="py-2 px-3">Description</th>
                                <th className="py-2 px-3 text-center">Qty</th>
                                <th className="py-2 px-3 text-right">Unit Price</th>
                                <th className="py-2 px-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {doc.extractedData.lineItems.map((item, i) => (
                                <tr key={i}>
                                  <td className="py-2 px-3">{item.description}</td>
                                  <td className="py-2 px-3 text-center">{item.quantity}</td>
                                  <td className="py-2 px-3 text-right">₹{item.unitPrice.toFixed(2)}</td>
                                  <td className="py-2 px-3 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <div className="text-right">
                          <span className="text-muted-foreground text-[10px] block">Total Amount</span>
                          <span className="font-mono text-brand font-bold text-sm">
                            {doc.extractedData.totalAmount != null ? `₹${doc.extractedData.totalAmount.toFixed(2)}` : "—"}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-[11px]">No extracted data available for this document.</p>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* TAB CONTENT: Raw JSON extracted structural data tree */}
            <TabsContent value="json" className="flex-1 overflow-y-auto p-4 bg-zinc-950 font-mono text-xs focus:outline-none">
              <div className="text-zinc-400 space-y-4">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 border-b border-zinc-800 pb-2">
                  <span>comparison_{comparison._id}.json</span>
                  <button
                    onClick={copyJson}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy Raw JSON"}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap break-words text-zinc-300 text-[11px] leading-relaxed">
{JSON.stringify(
  comparison.documents.map((d) => ({ kind: d.kind, fileName: d.fileName, extractedData: d.extractedData })),
  null,
  2
)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT PANEL: Grounded AI Chat Engine */}
        <div className="lg:col-span-5 flex flex-col h-full bg-card rounded-xl border border-border/80 overflow-hidden">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border/60 shrink-0">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-brand" />
              AI Assistant
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
              Grounded on{" "}
              {comparison.documents.map((d, i) => (
                <span key={d._id} className="font-mono text-foreground font-medium">
                  {d.kind}
                  {i < comparison.documents.length - 1 ? "," : ""}
                </span>
              ))}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              const isAI = msg.sender === "ai";
              return (
                <div key={msg.id} className={cn("flex items-start gap-3", !isAI && "flex-row-reverse")}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                    isAI ? "bg-brand/10 border-brand/20 text-brand" : "bg-secondary border-border"
                  )}>
                    {isAI ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5 text-muted-foreground" />}
                  </div>
                  <div className="space-y-1 max-w-[82%]">
                    <div className={cn(
                      "p-3.5 rounded-2xl text-xs leading-relaxed font-normal whitespace-pre-line shadow-sm border",
                      isAI
                        ? "bg-secondary/40 text-foreground border-border/50 rounded-tl-none"
                        : "bg-brand text-brand-foreground border-brand rounded-tr-none"
                    )}>
                      {msg.text}
                    </div>
                    <div className={cn("text-[9px] text-muted-foreground/60 px-1", !isAI && "text-right")}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-brand/10 border-brand/20 text-brand">
                  <Bot className="w-4.5 h-4.5 animate-pulse" />
                </div>
                <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/50 rounded-tl-none text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-brand" />
                  AI is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 pt-2 pb-1 border-t border-border/40 shrink-0 bg-secondary/10">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {SUGGESTIONS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(chip)}
                  disabled={isTyping}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-border/80 bg-card hover:bg-secondary text-[10px] font-medium transition-colors hover:text-foreground cursor-pointer text-muted-foreground flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-brand/75" />
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-border/40 shrink-0 bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="relative flex items-center bg-secondary/50 border border-border rounded-xl px-3 py-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-all duration-300"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about discrepancies, tax details..."
                className="w-full h-8 bg-transparent text-xs resize-none placeholder:text-muted-foreground/60 focus:outline-none pr-8 pt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isTyping}
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-brand hover:bg-brand/90 text-brand-foreground rounded-lg transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
            <div className="text-[10px] text-muted-foreground/50 text-center mt-2 flex items-center justify-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              <span>Press Enter to send. Powered by Gemini, grounded on this comparison only.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
