import { normalizeEmail } from "@/lib/auth/login-code";

export function bootstrapAdminEmails(raw: string | undefined): Set<string> {
  const emails = new Set<string>();
  if (!raw) return emails;
  for (const part of raw.split(",")) {
    const email = normalizeEmail(part);
    if (email) emails.add(email);
  }
  return emails;
}

export function isBootstrapAdmin(
  email: string,
  raw: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return bootstrapAdminEmails(raw).has(normalized);
}

export function signInRole(
  email: string | null | undefined,
  raw: string | undefined = process.env.ADMIN_EMAILS,
): "USER" | "ADMIN" {
  if (!email || !isBootstrapAdmin(email, raw)) return "USER";
  return "ADMIN";
}
