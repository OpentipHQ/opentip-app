import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || email.length < 3) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeCode(value: string): string {
  return value.replace(/\s/g, "");
}

export function generateLoginCode(random: () => number = () => randomInt(0, 1_000_000)): string {
  return String(random()).padStart(6, "0");
}

export function hashLoginCode(code: string, email: string, secret: string): string {
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export function codesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function hashIp(ip: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

export type CodeRow = {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
};

export type CodeVerdict =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "wrong" | "too_many"; increment: boolean };

export function assessLoginCode(args: {
  row: CodeRow | null;
  code: string;
  email: string;
  secret: string;
  now: Date;
  maxAttempts?: number;
}): CodeVerdict {
  const max = args.maxAttempts ?? MAX_ATTEMPTS;
  const row = args.row;
  if (!row || row.consumedAt) return { ok: false, reason: "missing", increment: false };
  if (row.attempts >= max) return { ok: false, reason: "too_many", increment: false };
  if (row.expiresAt.getTime() <= args.now.getTime()) {
    return { ok: false, reason: "expired", increment: false };
  }
  const code = normalizeCode(args.code);
  const hashed = hashLoginCode(code, args.email, args.secret);
  if (!/^\d{6}$/.test(code) || !codesMatch(hashed, row.codeHash)) {
    const reason = row.attempts + 1 >= max ? "too_many" : "wrong";
    return { ok: false, reason, increment: true };
  }
  return { ok: true };
}

export function planLoginCode(args: {
  approved: boolean;
  recentEmailCount: number;
  recentIpCount: number;
  lastSentAt: Date | null;
  now: Date;
  email: string;
  secret: string;
  code?: string;
}):
  | { ok: false; reason: "waitlist" | "rate" | "cooldown" }
  | { ok: true; code: string; codeHash: string; expiresAt: Date } {
  if (!args.approved) return { ok: false, reason: "waitlist" };
  if (
    args.recentEmailCount >= MAX_CODES_PER_EMAIL_PER_HOUR ||
    args.recentIpCount >= MAX_CODES_PER_IP_PER_HOUR
  ) {
    return { ok: false, reason: "rate" };
  }
  if (args.lastSentAt && args.now.getTime() - args.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown" };
  }
  const code = args.code ?? generateLoginCode();
  return {
    ok: true,
    code,
    codeHash: hashLoginCode(code, args.email, args.secret),
    expiresAt: new Date(args.now.getTime() + CODE_TTL_MS),
  };
}

export function cooldownRemaining(lastSentAt: Date | null, now: Date): number {
  if (!lastSentAt) return 0;
  const left = RESEND_COOLDOWN_MS - (now.getTime() - lastSentAt.getTime());
  if (left <= 0) return 0;
  return Math.ceil(left / 1000);
}

export function hourAgo(now: Date): Date {
  return new Date(now.getTime() - HOUR_MS);
}
