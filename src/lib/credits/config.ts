/**
 * Credit pricing.
 *
 * One credit is one US cent of tracked model cost: 100 credits = $1.00 USD.
 * The dollar amount is the token cost already stored on UsageEntry.estimatedCostUsd
 * and Job.estimatedCostUsd after a job finishes. Hosting, sites, and tips cost nothing.
 *
 * A positive cost rounds to the nearest credit. Any positive cost below half a credit
 * is still charged as 1 credit, so a real model call is recorded.
 *
 * MONTHLY_REFILL_CREDITS is granted once per UTC month, on top of the current balance.
 * The next grant is always the 1st of the following month.
 * LOW_BALANCE_CREDITS is the point where the app shows the short balance banner.
 * The daily safety cap stays in src/lib/copilot/caps.ts and is not shown in the product.
 */
export const CREDITS_PER_USD = 100;

export const MONTHLY_REFILL_CREDITS = 500;

export const LOW_BALANCE_CREDITS = 50;

export const NO_CREDITS_MESSAGE = "No credits left.";

export type CreditKindName = "MIGRATION" | "REFILL" | "GRANT" | "REMOVAL" | "SPEND";

export type AiJobKind = "FIRST_BUILD" | "PUSH_UPDATE" | "CHAT_EDIT" | "SUMMARY_REFRESH";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function creditsFromUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.max(1, Math.round(usd * CREDITS_PER_USD));
}

export function usdFromCredits(credits: number): number {
  if (!Number.isFinite(credits)) return 0;
  return Math.round((credits / CREDITS_PER_USD) * 10_000) / 10_000;
}

export function openingCreditsFromUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd === 0) return 0;
  return Math.round(usd * CREDITS_PER_USD);
}

export function spendActionLabel(kind: AiJobKind): string {
  if (kind === "FIRST_BUILD") return "First build";
  if (kind === "PUSH_UPDATE") return "Rebuild";
  if (kind === "CHAT_EDIT") return "Chat edit";
  return "Regeneration";
}

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextRefillLabel(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `${MONTHS[next.getUTCMonth()]} 1`;
}

export function refillSentence(now: Date): string {
  return `Refills ${nextRefillLabel(now)}`;
}

export function lowBalanceSentence(balance: number, now: Date): string {
  const left = Math.max(0, Math.trunc(balance));
  return `${left} credits left. ${refillSentence(now)}.`;
}
