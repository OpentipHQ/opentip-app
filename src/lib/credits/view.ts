import { lowBalanceSentence, refillSentence } from "@/lib/credits/config";
import {
  isLowBalance,
  creditsByAction,
  creditsByWorkspace,
  creditsSpentByDay,
  historyLabel,
  periodTotals,
  type LedgerRow,
} from "@/lib/credits/math";
import { creditBalanceFor } from "@/lib/credits/apply";
import { getPrisma } from "@/lib/db";

export type CreditHistoryRow = {
  id: string;
  label: string;
  amount: number;
  when: string;
};

export type CreditView = {
  connected: boolean;
  balance: number;
  low: boolean;
  banner: string | null;
  refill: string;
  granted: number;
  used: number;
  days: { day: string; label: string; credits: number }[];
  workspaces: { name: string; credits: number }[];
  actions: { name: string; credits: number }[];
  history: CreditHistoryRow[];
};

const EMPTY: CreditView = {
  connected: false,
  balance: 0,
  low: false,
  banner: null,
  refill: "",
  granted: 0,
  used: 0,
  days: [],
  workspaces: [],
  actions: [],
  history: [],
};

export async function loadCreditView(userId: string, now = new Date()): Promise<CreditView> {
  const prisma = getPrisma();
  if (!prisma) return { ...EMPTY, refill: refillSentence(now) };
  const balance = await creditBalanceFor(userId, now);
  const entries = await prisma.creditEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { site: { select: { name: true } } },
  });
  const rows: LedgerRow[] = entries.map((entry) => ({
    amount: entry.amount,
    kind: entry.kind,
    createdAt: entry.createdAt,
    siteId: entry.siteId,
    siteName: entry.site?.name ?? null,
    action: entry.action,
  }));
  const period = periodTotals(rows, now);
  const low = isLowBalance(balance);
  return {
    connected: true,
    balance,
    low,
    banner: low ? lowBalanceSentence(balance, now) : null,
    refill: refillSentence(now),
    granted: period.granted,
    used: period.used,
    days: creditsSpentByDay(rows, now),
    workspaces: creditsByWorkspace(rows),
    actions: creditsByAction(rows),
    history: entries.slice(0, 40).map((entry) => ({
      id: entry.id,
      label: historyLabel({
        kind: entry.kind,
        action: entry.action,
        siteName: entry.site?.name,
        reason: entry.reason,
      }),
      amount: entry.amount,
      when: entry.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }),
    })),
  };
}
