"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Sparkles,
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signup, ApiClientError } from "@/lib/api-client";
import { isValidEmail, isValidName, isPasswordValid, passwordRequirements, passwordStrength } from "@/lib/validators";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirmPassword: false });
  const markTouched = (field: keyof typeof touched) => setTouched((t) => ({ ...t, [field]: true }));

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((body) => {
        if (body.success && body.data) {
          router.push("/dashboard");
        }
      })
      .catch(() => {});
  }, [router]);

  const nameValid = isValidName(name);
  const emailValid = isValidEmail(email);
  const requirements = useMemo(() => passwordRequirements(password), [password]);
  const passwordValid = isPasswordValid(password);
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;
  const strength = passwordStrength(password);

  const formValid = nameValid && emailValid && passwordValid && confirmValid;

  const nameError = touched.name && !nameValid ? "Enter a name of at least 2 characters." : "";
  const emailError = touched.email && email.length > 0 && !emailValid ? "Enter a valid email address." : "";
  const confirmError = touched.confirmPassword && confirmPassword.length > 0 && !confirmValid ? "Passwords do not match." : "";

  const strengthBarColor =
    strength === "weak" ? "bg-destructive" : strength === "fair" ? "bg-warning" : strength === "good" ? "bg-brand" : "bg-success";
  const strengthWidth = strength === "weak" ? "25%" : strength === "fair" ? "50%" : strength === "good" ? "75%" : "100%";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    if (!formValid) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setLoading(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Sign up failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center grid-background px-4">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand/10 rounded-full blur-[80px] -z-10 pointer-events-none" />

      <div className="w-full max-w-[420px] animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-sidebar flex items-center justify-center text-sidebar-primary border border-sidebar-border shadow-md mb-3">
            <Layers className="w-6 h-6 text-brand" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">DocIntel Platform</h1>
          <p className="text-xs text-muted-foreground mt-1">Enterprise-grade document intelligence</p>
        </div>

        <Card className="border-border/80 shadow-xl bg-card/85 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Create Account</CardTitle>
            <CardDescription className="text-xs">
              Sign up to access the document workspace
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched("name")}
                  aria-invalid={!!nameError}
                  className={cn("bg-secondary/40 h-10 border-border", nameError && "border-destructive focus-visible:ring-destructive/30")}
                />
                {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
              </div>

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
                  onBlur={() => markTouched("email")}
                  aria-invalid={!!emailError}
                  className={cn("bg-secondary/40 h-10 border-border", emailError && "border-destructive focus-visible:ring-destructive/30")}
                />
                {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => markTouched("password")}
                    aria-invalid={touched.password && !passwordValid}
                    className={cn(
                      "bg-secondary/40 h-10 border-border pr-10",
                      touched.password && !passwordValid && "border-destructive focus-visible:ring-destructive/30"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="h-1 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", strengthBarColor)}
                        style={{ width: strengthWidth }}
                      />
                    </div>
                    <ul className="grid grid-cols-1 gap-0.5">
                      {requirements.map((req) => (
                        <li key={req.key} className="flex items-center gap-1.5 text-[11px]">
                          {req.met ? (
                            <Check className="w-3 h-3 text-success shrink-0" />
                          ) : (
                            <X className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                          )}
                          <span className={req.met ? "text-muted-foreground" : "text-muted-foreground/60"}>
                            {req.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Confirm Password
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched("confirmPassword")}
                  aria-invalid={!!confirmError}
                  className={cn("bg-secondary/40 h-10 border-border", confirmError && "border-destructive focus-visible:ring-destructive/30")}
                />
                {confirmError && <p className="text-[11px] text-destructive">{confirmError}</p>}
              </div>

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
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Already have an account?{" "}
          <a href="/login" className="font-semibold text-brand hover:underline">
            Sign in
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
