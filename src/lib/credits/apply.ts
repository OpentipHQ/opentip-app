import { Prisma } from "@/generated/prisma/client";
import {
  MONTHLY_REFILL_CREDITS,
  NO_CREDITS_MESSAGE,
  creditsFromUsd,
  monthStartUtc,
  spendActionLabel,
  usdFromCredits,
  type AiJobKind,
} from "@/lib/credits/config";
import { adjustmentDelta, canStartAiAction, refillDue, sumCredits } from "@/lib/credits/math";
import { getPrisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

async function writeBalance(tx: Tx, userId: string): Promise<number> {
  const rows = await tx.creditEntry.findMany({
    where: { userId },
    select: { amount: true },
  });
  const balance = sumCredits(rows);
  await tx.user.update({
    where: { id: userId },
    data: {
      creditBalance: balance,
      creditUsd: usdFromCredits(balance),
    },
  });
  return balance;
}

export async function ensureMonthlyRefill(userId: string, now = new Date()): Promise<number | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) return null;
    await lockUser(tx, userId);
    const refills = await tx.creditEntry.findMany({
      where: { userId, kind: "REFILL", createdAt: { gte: monthStartUtc(now) } },
      select: { kind: true, createdAt: true },
    });
    if (!refillDue(refills.map((row) => ({ kind: "REFILL", createdAt: row.createdAt })), now)) {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      });
      return current?.creditBalance ?? 0;
    }
    await tx.creditEntry.create({
      data: {
        userId,
        amount: MONTHLY_REFILL_CREDITS,
        kind: "REFILL",
        action: "Monthly refill",
      },
    });
    return writeBalance(tx, userId);
  });
}

export async function creditBalanceFor(userId: string, now = new Date()): Promise<number> {
  const refilled = await ensureMonthlyRefill(userId, now);
  if (refilled !== null) return refilled;
  const prisma = getPrisma();
  if (!prisma) return 0;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });
  return user?.creditBalance ?? 0;
}

export async function assertCredits(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const balance = await creditBalanceFor(userId);
  if (!canStartAiAction(balance)) return { ok: false, error: NO_CREDITS_MESSAGE };
  return { ok: true };
}

export async function recordUsageSpend(usageId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  const usage = await prisma.usageEntry.findUnique({
    where: { id: usageId },
    select: {
      id: true,
      status: true,
      estimatedCostUsd: true,
      jobId: true,
      job: { select: { id: true, kind: true } },
      repo: { select: { site: { select: { id: true, name: true, ownerId: true } } } },
    },
  });
  if (!usage || usage.status !== "FINAL") return;
  const ownerId = usage.repo.site?.ownerId;
  if (!ownerId) return;
  const credits = creditsFromUsd(Number(usage.estimatedCostUsd));
  if (credits <= 0) return;
  const kind = usage.job?.kind;
  const action =
    kind === "FIRST_BUILD" || kind === "PUSH_UPDATE" || kind === "CHAT_EDIT" || kind === "SUMMARY_REFRESH"
      ? spendActionLabel(kind as AiJobKind)
      : "AI action";
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, ownerId);
    const existing = await tx.creditEntry.findUnique({
      where: { usageEntryId: usage.id },
      select: { id: true },
    });
    if (existing) return;
    await tx.creditEntry.create({
      data: {
        userId: ownerId,
        amount: -credits,
        kind: "SPEND",
        action,
        reason: usage.repo.site?.name ?? null,
        siteId: usage.repo.site?.id,
        jobId: usage.job?.id ?? usage.jobId,
        usageEntryId: usage.id,
      },
    });
    await writeBalance(tx, ownerId);
  });
}

export async function adjustCredits(input: {
  userId: string;
  actorId: string;
  mode: "grant" | "remove";
  credits: number;
  reason: string;
}): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const prisma = getPrisma();
  if (!prisma) return { ok: false, error: "The database is not connected." };
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, creditBalance: true },
    });
    if (!user) return { ok: false, error: "That user no longer exists." };
    await lockUser(tx, user.id);
    const locked = await tx.user.findUnique({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    const decision = adjustmentDelta({
      mode: input.mode,
      credits: input.credits,
      balance: locked?.creditBalance ?? user.creditBalance,
      reason: input.reason,
    });
    if (!decision.ok) return decision;
    await tx.creditEntry.create({
      data: {
        userId: user.id,
        amount: decision.delta,
        kind: input.mode === "grant" ? "GRANT" : "REMOVAL",
        action: input.mode === "grant" ? "Admin grant" : "Admin removal",
        reason: decision.reason,
        actorId: input.actorId,
      },
    });
    const balance = await writeBalance(tx, user.id);
    return { ok: true, balance };
  });
}

export async function requestMoreCredits(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = getPrisma();
  if (!prisma) return { ok: false, error: "The database is not connected." };
  const open = await prisma.creditRequest.findFirst({
    where: { userId, status: "OPEN" },
    select: { id: true },
  });
  if (open) return { ok: true };
  await prisma.creditRequest.create({ data: { userId, status: "OPEN" } });
  return { ok: true };
}
