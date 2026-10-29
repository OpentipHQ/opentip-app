import {
  LOW_BALANCE_CREDITS,
  monthStartUtc,
  type CreditKindName,
} from "@/lib/credits/config";

export type LedgerRow = {
  amount: number;
  kind: CreditKindName;
  createdAt: Date;
  siteId?: string | null;
  siteName?: string | null;
  action?: string | null;
};

export function sumCredits(rows: { amount: number }[]): number {
  return rows.reduce((total, row) => total + row.amount, 0);
}

export function balancesMatch(balance: number, rows: { amount: number }[]): boolean {
  return balance === sumCredits(rows);
}

export function canStartAiAction(balance: number): boolean {
  return balance > 0;
}

export function isLowBalance(balance: number, threshold = LOW_BALANCE_CREDITS): boolean {
  return balance <= threshold;
}

export function refillDue(rows: { kind: CreditKindName; createdAt: Date }[], now: Date): boolean {
  const start = monthStartUtc(now).getTime();
  return !rows.some((row) => row.kind === "REFILL" && row.createdAt.getTime() >= start);
}

export function periodTotals(rows: LedgerRow[], now: Date): { granted: number; used: number } {
  const start = monthStartUtc(now).getTime();
  let granted = 0;
  let used = 0;
  for (const row of rows) {
    if (row.createdAt.getTime() < start) continue;
    if (row.amount > 0) granted += row.amount;
    else used += -row.amount;
  }
  return { granted, used };
}

export type DayBucket = { day: string; label: string; credits: number };

export function creditsSpentByDay(rows: LedgerRow[], now: Date): DayBucket[] {
  const start = monthStartUtc(now);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const buckets = new Map<string, number>();
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    buckets.set(new Date(cursor).toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    if (row.amount >= 0 || row.kind !== "SPEND") continue;
    const key = row.createdAt.toISOString().slice(0, 10);
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + -row.amount);
  }
  return Array.from(buckets.entries()).map(([day, credits]) => ({
    day,
    label: dayLabel(day, now),
    credits,
  }));
}

function dayLabel(day: string, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  if (day === today) return "Today";
  const date = new Date(`${day}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type NamedTotal = { name: string; credits: number };

export function creditsByWorkspace(rows: LedgerRow[]): NamedTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount >= 0 || row.kind !== "SPEND") continue;
    const name = row.siteName?.trim() || "Workspace";
    totals.set(name, (totals.get(name) ?? 0) + -row.amount);
  }
  return Array.from(totals.entries())
    .map(([name, credits]) => ({ name, credits }))
    .sort((left, right) => right.credits - left.credits || left.name.localeCompare(right.name));
}

export function creditsByAction(rows: LedgerRow[]): NamedTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.amount >= 0 || row.kind !== "SPEND") continue;
    const name = row.action?.trim() || "AI action";
    totals.set(name, (totals.get(name) ?? 0) + -row.amount);
  }
  return Array.from(totals.entries())
    .map(([name, credits]) => ({ name, credits }))
    .sort((left, right) => right.credits - left.credits || left.name.localeCompare(right.name));
}

export function historyLabel(row: {
  kind: CreditKindName;
  action?: string | null;
  siteName?: string | null;
  reason?: string | null;
}): string {
  if (row.kind === "REFILL") return "Monthly refill";
  if (row.kind === "MIGRATION") return "Opening balance";
  if (row.kind === "GRANT") return "Admin grant";
  if (row.kind === "REMOVAL") return "Admin removal";
  const action = row.action?.trim() || "AI action";
  const site = row.siteName?.trim();
  return site ? `${action}, ${site}` : action;
}

export function adjustmentDelta(input: {
  mode: "grant" | "remove";
  credits: number;
  balance: number;
  reason: string;
}): { ok: true; delta: number; reason: string } | { ok: false; error: string } {
  const credits = Math.trunc(input.credits);
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required." };
  if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) {
    return { ok: false, error: "Enter a credit amount." };
  }
  if (input.mode === "remove" && credits > Math.max(0, input.balance)) {
    return { ok: false, error: "Not enough credits." };
  }
  return {
    ok: true,
    delta: input.mode === "grant" ? credits : -credits,
    reason: reason.slice(0, 500),
  };
}
