/**
 * Client-side mirrors of the auth validation rules in
 * lib/api-utils/validation.ts. Duplicated intentionally — the server schema
 * is the source of truth and re-validates everything regardless, but
 * client-side checks let the UI show specific, real-time feedback instead
 * of waiting on a round-trip (or surfacing a generic "Request validation
 * failed" from the server's flattened Zod error).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export interface PasswordRequirement {
  key: string;
  label: string;
  met: boolean;
}

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { key: "length", label: "At least 8 characters", met: password.length >= 8 },
    { key: "letter", label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { key: "number", label: "Contains a number", met: /[0-9]/.test(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return passwordRequirements(password).every((r) => r.met);
}

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "weak";
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3 || score === 4) return "good";
  return "strong";
}

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && /[A-Za-z]/.test(trimmed);
}
