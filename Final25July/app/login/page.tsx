"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { login, ApiClientError } from "@/lib/api-client";
import { isValidEmail } from "@/lib/validators";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((body) => {
        if (body.success && body.data) {
          const next = searchParams.get("next");
          router.push(next && next.startsWith("/dashboard") ? next : "/dashboard");
        }
      })
      .catch(() => {});
  }, [router, searchParams]);

  const emailValid = isValidEmail(email);
  const formValid = emailValid && password.length > 0;
  const emailError = touched.email && email.length > 0 && !emailValid ? "Enter a valid email address." : "";
  const passwordError = touched.password && password.length === 0 ? "Password is required." : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTouched({ email: true, password: true });

    if (!formValid) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/dashboard") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Sign in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center grid-background px-4">
      {/* Glow highlight background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand/10 rounded-full blur-[80px] -z-10 pointer-events-none" />

      <div className="w-full max-w-[420px] animate-fade-in-up">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-sidebar flex items-center justify-center text-sidebar-primary border border-sidebar-border shadow-md mb-3">
            <Layers className="w-6 h-6 text-brand" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">DocIntel Platform</h1>
          <p className="text-xs text-muted-foreground mt-1">Enterprise-grade document intelligence</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 shadow-xl bg-card/85 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your credentials to access the document workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Work Email
                </label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  aria-invalid={!!emailError}
                  className={cn("bg-secondary/40 h-10 border-border", emailError && "border-destructive")}
                />
                {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    Password
                  </label>
                  <a href="#" className="text-[10px] font-semibold text-brand hover:underline">
                    Forgot Password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    aria-invalid={!!passwordError}
                    className={cn("bg-secondary/40 h-10 border-border pr-10", passwordError && "border-destructive")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && <p className="text-[11px] text-destructive">{passwordError}</p>}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !formValid}
                className="w-full h-10 bg-brand text-brand-foreground hover:bg-brand/90 transition-all font-semibold rounded-lg text-xs gap-2 flex items-center justify-center shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-brand-foreground" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sign up + support hints */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-semibold text-brand hover:underline">
            Create one
          </a>
        </p>
        <p className="text-center text-[10px] text-muted-foreground/60 mt-3 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand" />
          <span>Need help? Contact system support at support@docintel.com</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
