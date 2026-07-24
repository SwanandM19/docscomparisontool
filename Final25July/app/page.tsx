"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  Sparkles,
  ArrowRight,
  Bot,
  ArrowRightLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Play,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StepType = "upload" | "extract" | "match" | "complete";

export default function LandingPage() {
  // Interactive Simulator State
  const [simStep, setSimStep] = useState<StepType>("upload");
  const [simProgress, setSimProgress] = useState(0);
  const [simActive, setSimActive] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((body) => {
        if (body.success && body.data) {
          setIsLoggedIn(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!simActive) return;

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 100) {
          setSimStep((currentStep) => {
            if (currentStep === "upload") {
              setSimProgress(0);
              return "extract";
            }
            if (currentStep === "extract") {
              setSimProgress(0);
              return "match";
            }
            if (currentStep === "match") {
              setSimProgress(0);
              return "complete";
            }
            setSimActive(false);
            return "complete";
          });
          return 100;
        }
        return prev + 10; // Slightly optimized speed for smoother visual step transitions
      });
    }, 100);

    return () => clearInterval(interval);
  }, [simActive]);

  const handleStartSim = () => {
    setSimStep("upload");
    setSimProgress(0);
    setSimActive(true);
  };

  const handleResetSim = () => {
    setSimStep("upload");
    setSimProgress(0);
    setSimActive(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-[#F8FAFC] text-slate-800 flex flex-col justify-between relative overflow-y-auto antialiased font-sans">

      {/* ── Visual Mesh Background (Aesthetic abstract grids) ── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#fff_70%,transparent_100%)] pointer-events-none z-0" />

      {/* Deep Luxury Ambient Radial Core Glows */}
      <div className="absolute top-[-10%] left-[5%] w-[700px] h-[500px] bg-gradient-to-tr from-indigo-500/10 via-violet-500/5 to-transparent rounded-full blur-[140px] z-0 pointer-events-none opacity-90" />
      <div className="absolute bottom-[20%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-bl from-amber-500/5 via-indigo-500/5 to-transparent rounded-full blur-[160px] z-0 pointer-events-none opacity-80" />

      {/* ── Premium Sticky Header ── */}
      <header className="bg-white/75 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 shrink-0 z-50 transition-all duration-300">
        <div className="max-w-[1400px] mx-auto h-16 px-6 sm:px-8 flex items-center justify-between">

          {/* Logo Group */}
          <a href="/" className="flex items-center gap-3 group cursor-pointer no-underline">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 group-hover:rotate-1 transition-all duration-300">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col justify-center text-left">
              <span className="text-sm font-black tracking-tight text-slate-900 leading-none">DocIntel</span>
              <span className="text-[9px] text-indigo-600 font-extrabold tracking-widest block mt-0.5 uppercase">Workspace</span>
            </div>
          </a>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-500/90">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#docs" className="hover:text-indigo-600 transition-colors">Developer API</a>
            <a href="#security" className="hover:text-indigo-600 transition-colors">Enterprise Security</a>
          </nav>

          {/* Action Button */}
          <div className="flex items-center gap-4">
            <a href={isLoggedIn ? "/dashboard" : "/login"} className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              {isLoggedIn ? "Go to Dashboard" : "Sign In"}
            </a>
            <Separator orientation="vertical" className="h-4 bg-slate-200" />
            <Button
              onClick={() => window.location.href = isLoggedIn ? "/dashboard" : "/login"}
              size="sm"
              className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98] transition-all px-4"
            >
              {isLoggedIn ? "Dashboard" : "Get Started"}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Hero Dashboard (Splitscreen Workspace Grid) ── */}
      <main className="flex-1 flex items-center justify-center relative z-20 px-6 sm:px-8 py-10 lg:py-4">
        <div className="max-w-[1360px] w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* LEFT HERO COLUMN */}
          <div className="lg:col-span-5 space-y-6 text-left">
            {/* Tag pill */}
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-[10px] font-black py-1 px-3 rounded-full text-indigo-600 shadow-sm w-fit">
              <Sparkles className="w-3 h-3 animate-pulse" />
              <span>Grounded Document Workspace v4.1</span>
              <ChevronRight className="w-2.5 h-2.5 text-indigo-400" />
            </div>

            {/* Premium Header */}
            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black tracking-tight text-slate-900 leading-[1.1] max-w-xl">
              Automate Audits with{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-amber-500 bg-clip-text text-transparent">
                Grounded AI
              </span>
            </h1>

            {/* Subtext Paragraph */}
            <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed font-normal">
              Cross-reference purchase orders, delivery notes, and multi-page invoices line-by-line using RAG-powered extraction models. Flag metadata variances instantly with zero hallucination risk.
            </p>

            {/* Interactive CTA Controls */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3.5 max-w-md">
              <Button
                onClick={() => window.location.href = isLoggedIn ? "/dashboard" : "/login"}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold px-6 h-11.5 rounded-xl shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all gap-2 flex items-center justify-center cursor-pointer"
              >
                {isLoggedIn ? "Go to Dashboard" : "Launch Platform"}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                onClick={() => window.location.href = isLoggedIn ? "/dashboard" : "/login"}
                variant="outline"
                className="w-full sm:w-auto text-xs font-bold px-6 h-11.5 rounded-xl border-slate-200 bg-white/80 hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-all shadow-sm"
              >
                Request API Access
              </Button>
            </div>

            {/* Ingestion Pipeline Badges */}
            <div className="pt-5 border-t border-slate-200/60 max-w-md flex items-center justify-between text-[11px] text-slate-500 font-bold">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>PO Verification</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>GRN Checking</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Invoice Matching</span>
              </div>
            </div>
          </div>

          {/* RIGHT HERO COLUMN: Interactive Live Simulator Sandbox */}
          <div className="lg:col-span-7 flex flex-col gap-5 w-full">

            <div id="docs" className="bg-white/80 border border-slate-200/80 rounded-2xl p-5 shadow-[0_32px_64px_-16px_rgba(99,102,241,0.12)] backdrop-blur-md relative overflow-hidden ring-1 ring-slate-100 scroll-mt-24">
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-indigo-600 via-violet-500 to-amber-500" />

              {/* Simulator Header Layout */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", simActive ? "bg-indigo-600 animate-pulse" : "bg-slate-400")} />
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Live Execution Sandbox</span>
                </div>
                <div>
                  {!simActive && simStep === "complete" ? (
                    <Button onClick={handleResetSim} variant="outline" size="sm" className="h-7 text-[10px] font-bold border-slate-200 hover:bg-slate-50 text-slate-600 gap-1 px-2.5 rounded-lg shadow-sm">
                      <RotateCcw className="w-3 h-3" />
                      Reset View
                    </Button>
                  ) : (
                    <Button onClick={handleStartSim} disabled={simActive} className="h-7 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-3 rounded-lg shadow-sm disabled:opacity-50">
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Simulate Audit Pipeline
                    </Button>
                  )}
                </div>
              </div>

              {/* Sandbox Monitor Panel (Dark Mode Terminal for Visual Contrast Pop) */}
              <div className="h-[220px] bg-slate-950 text-slate-200 rounded-xl border border-slate-800/80 p-4 font-mono text-[11px] flex flex-col justify-between overflow-hidden shadow-2xl relative">

                {/* Gloss Glass Overlay effect inside terminal screen */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

                {/* Step 1: Ingestion Engine */}
                {simStep === "upload" && (
                  <div className="space-y-1.5 transition-all duration-300">
                    <p className="text-slate-500">&gt; Initializing TLS secure document stream...</p>
                    <p className="text-indigo-400 font-medium">&gt; Processing PO-9821-Pinnacle.pdf ({simProgress}%)</p>
                    <p className="text-indigo-400 font-medium">&gt; Processing INV-2847-Pinnacle.xlsx ({simProgress}%)</p>
                    {simProgress > 50 && <p className="text-emerald-400/90">&gt; Storage verification hash matched.</p>}
                  </div>
                )}

                {/* Step 2: RAG Extraction Engine */}
                {simStep === "extract" && (
                  <div className="space-y-1.5 transition-all duration-300">
                    <p className="text-slate-500">&gt; Extraction payload maps initialized.</p>
                    <p className="text-violet-400 font-medium flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 animate-spin text-violet-400" />
                      Executing Vision Layout Parser ({simProgress}%)
                    </p>
                    <p className="text-slate-400">&gt; Pinpointing items, tax codes, and volumetric variables...</p>
                    {simProgress > 60 && <p className="text-slate-500">&gt; Context validation confidence: 99.8%</p>}
                  </div>
                )}

                {/* Step 3: Match Engine */}
                {simStep === "match" && (
                  <div className="space-y-1.5 transition-all duration-300">
                    <p className="text-slate-500">&gt; Normalizing data trees across formats...</p>
                    <p className="text-amber-400 font-medium flex items-center gap-2">
                      <ArrowRightLeft className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                      Reconciling structural arrays against compliance metrics ({simProgress}%)
                    </p>
                    <p className="text-slate-500">&gt; Applied Variance Tolerance Matrix: ±1.5% max threshold</p>
                    {simProgress > 50 && <p className="text-rose-400 font-semibold animate-pulse">&gt; ALERT DETECTED: Discrepancy identified in sequence Line #003.</p>}
                  </div>
                )}

                {/* Step 4: Finished Reconciliation Matrix View */}
                {simStep === "complete" && (
                  <div className="space-y-3 transition-all duration-300 w-full">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Audit Complete [Status: Discrepancy Resolved]
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-slate-300 text-[10px]">
                      <div className="bg-slate-900/50 p-1.5 rounded border border-slate-800/40">
                        <span className="text-slate-500 block mb-0.5 uppercase tracking-wide">LINE 1 (Server Components)</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">✓ MATCHING MATRICES</span>
                      </div>
                      <div className="bg-slate-900/50 p-1.5 rounded border border-slate-800/40">
                        <span className="text-slate-500 block mb-0.5 uppercase tracking-wide">LINE 3 (Cat6a Struct Cables)</span>
                        <span className="text-amber-400 font-bold flex items-center gap-1">⚠ Rate Delta ($95 vs $85)</span>
                      </div>
                    </div>
                    <div className="bg-indigo-950/40 border border-indigo-900/60 p-2 rounded-lg flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-semibold">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        Automated AI Action
                      </span>
                      <span className="font-bold text-amber-400 text-[10px]">Hold Processing & Alert Supplier</span>
                    </div>
                  </div>
                )}

                {/* Bottom Status metadata ticker wrapper */}
                <div className="border-t border-slate-900 pt-2 flex items-center justify-between text-[9px] text-slate-600 font-mono">
                  <span>Core System: DocIntel-Engine-v4</span>
                  {simActive ? (
                    <span className="text-indigo-400 font-bold animate-pulse">Running Pipeline Engine... {simProgress}%</span>
                  ) : (
                    <span className="text-slate-500">Idle / Ready</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sub Feature Advantage Grid layout wrappers */}
            <div id="features" className="grid grid-cols-1 sm:grid-cols-2 gap-4 scroll-mt-24">
              {[
                { label: "Universal Formats Ingestion", desc: "Native parsing across multi-page PDFs, complex Excel datasets, XML inputs, and low-res structural images." },
                { label: "Deterministic Grounded Citations", desc: "No generic language guesses. Every value extracted features exact pixel bounding coordinate vectors." }
              ].map((hl) => (
                <div key={hl.label} className="bg-white/70 border border-slate-200/50 rounded-xl p-4 shadow-sm text-left backdrop-blur-sm hover:shadow-md transition-shadow duration-300">
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    {hl.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed font-normal">
                    {hl.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Enterprise Security Card */}
            <div id="security" className="bg-white/70 border border-slate-200/50 rounded-xl p-4 shadow-sm text-left backdrop-blur-sm scroll-mt-24 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight">Enterprise Security</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed font-normal">
                    SOC2 compliant architecture featuring TLS 1.3 encryption, role-based access control, and complete audit trail logging.
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[9px] font-black uppercase shrink-0 py-0.5 px-2">
                SOC2 Secure
              </Badge>
            </div>
          </div>
        </div>
      </main>

      {/* ── Single Screen Sticky Base Footer ── */}
      <footer className="py-4 border-t border-slate-200/50 bg-white/75 shrink-0 text-[10px] text-slate-500 relative z-30 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Layers className="w-3 text-indigo-600" />
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight">DocIntel Workspace</span>
            <span className="text-slate-300 font-semibold">|</span>
            <span>© 2026 Platform System. All rights reserved.</span>
          </div>
          <div className="flex gap-5 font-bold text-slate-500/90">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">SOC2 Compliance Report</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Custom simulated Divider layout element
function Separator({ orientation = "horizontal", className }: { orientation?: "horizontal" | "vertical"; className?: string }) {
  return (
    <div
      className={cn(
        "bg-slate-200 shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className
      )}
    />
  );
}