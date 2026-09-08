"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  User,
  Send,
  Sparkles,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getAssistantConversation,
  sendAssistantMessage,
  clearAssistantConversation,
  ApiClientError,
} from "@/lib/api-client";
import type { AssistantMessage } from "@/types/assistant";

const SUGGESTIONS = [
  "How does Intelligent Comparison differ from the Document Comparator?",
  "Summarize my most recent comparison",
  "What do tolerance rules do?",
];

const WELCOME: AssistantMessage = {
  id: "welcome",
  sender: "ai",
  text: "Hi! I'm the DocIntel Assistant. Ask me how any part of the platform works, or about your own recent comparisons and activity.",
  timestamp: "",
};

const OPEN_KEY = "docintel.assistant.open";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AssistantWidget() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [clearing, setClearing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Client-only widget — don't server-render it at all (avoids hydration
  // mismatches from timestamps / restored open state).
  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(OPEN_KEY) === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { messages: stored } = await getAssistantConversation();
      setMessages(stored.length > 0 ? stored : [WELCOME]);
    } catch {
      // Keep the welcome message; the composer will surface send errors.
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  // Lazy-load the conversation the first time the panel is opened.
  useEffect(() => {
    if (open && !loadedOnce && !loading) load();
  }, [open, loadedOnce, loading, load]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, open]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, sender: "user", text: trimmed, timestamp: new Date().toISOString() },
    ]);
    setInput("");
    setIsTyping(true);

    try {
      const { message } = await sendAssistantMessage(trimmed);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "ai",
          text:
            err instanceof ApiClientError
              ? `Sorry, I couldn't answer that: ${err.message}`
              : "Sorry, something went wrong. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearAssistantConversation();
      setMessages([WELCOME]);
    } catch {
      /* non-critical */
    } finally {
      setClearing(false);
    }
  };

  const hasRealMessages = messages.some((m) => m.id !== "welcome");

  if (!mounted) return null;

  return (
    <>
      {/* Floating window */}
      <div
        className={cn(
          "fixed z-50 bottom-20 right-4 sm:right-6 w-[min(calc(100vw-2rem),380px)] h-[min(calc(100vh-8rem),560px)]",
          "flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden",
          "transition-all duration-200 origin-bottom-right",
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none",
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-secondary/30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-brand" />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">DocIntel Assistant</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Grounded on your own activity
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasRealMessages && (
              <button
                onClick={handleClear}
                disabled={clearing}
                title="Clear conversation"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
              >
                {clearing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              title="Close"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isAI = msg.sender === "ai";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex items-start gap-2", !isAI && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center shrink-0 border",
                        isAI
                          ? "bg-brand/10 border-brand/20 text-brand"
                          : "bg-secondary border-border",
                      )}
                    >
                      {isAI ? (
                        <Bot className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-0.5 max-w-[82%]">
                      <div
                        className={cn(
                          "px-3 py-2 rounded-xl text-[11px] leading-relaxed whitespace-pre-line border",
                          isAI
                            ? "bg-secondary/40 text-foreground border-border/50 rounded-tl-none"
                            : "bg-brand text-brand-foreground border-brand rounded-tr-none",
                        )}
                      >
                        {msg.text}
                      </div>
                      <div
                        className={cn(
                          "text-[9px] text-muted-foreground/50 px-1",
                          !isAI && "text-right",
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border bg-brand/10 border-brand/20 text-brand">
                    <Bot className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-secondary/40 border border-border/50 rounded-tl-none text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 animate-spin text-brand" />
                    Thinking…
                  </div>
                </div>
              )}

              {!hasRealMessages && !isTyping && (
                <div className="pt-1 flex flex-col gap-1.5">
                  {SUGGESTIONS.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(chip)}
                      className="text-left px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-secondary text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-brand/75 shrink-0" />
                      {chip}
                    </button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-border/50 shrink-0 bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="relative flex items-center bg-secondary/50 border border-border rounded-xl px-2.5 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-all"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about DocIntel…"
              rows={1}
              className="w-full max-h-24 bg-transparent text-[11px] resize-none placeholder:text-muted-foreground/60 focus:outline-none pr-8 py-1"
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
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 bg-brand hover:bg-brand/90 text-brand-foreground rounded-md"
            >
              <Send className="w-3 h-3" />
            </Button>
          </form>
        </div>
      </div>

      {/* Launcher button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className={cn(
          "fixed z-50 bottom-4 right-4 sm:right-6 w-12 h-12 rounded-full shadow-lg",
          "flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95",
          "bg-brand text-brand-foreground hover:bg-brand/90",
        )}
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>
    </>
  );
}
