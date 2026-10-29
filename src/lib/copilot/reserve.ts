import { Prisma } from "@/generated/prisma/client";
import {
  checkSpendCaps,
  utcDayKey,
  type CapDecision,
} from "@/lib/copilot/caps";
import { getPrisma } from "@/lib/db";

export async function reserveDailySpend(input: {
  repoId: string;
  estimateUsd: number;
  repoCapUsd: number;
  globalCapUsd: number;
  provider: "XAI" | "GROQ" | "FAKE";
  model: string;
  jobId?: string;
  now?: Date;
}): Promise<CapDecision & { usageId?: string }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is required to reserve spend");
  }
  const now = input.now ?? new Date();
  const day = new Date(`${utcDayKey(now)}T00:00:00.000Z`);
  return prisma.$transaction(
    async (tx) => {
      const [repoSpent, globalSpent] = await Promise.all([
        tx.usageEntry.aggregate({
          where: { repoId: input.repoId, day },
          _sum: { estimatedCostUsd: true },
        }),
        tx.usageEntry.aggregate({
          where: { day },
          _sum: { estimatedCostUsd: true },
        }),
      ]);
      const decision = checkSpendCaps({
        repoSpentUsd: Number(repoSpent._sum.estimatedCostUsd ?? 0),
        globalSpentUsd: Number(globalSpent._sum.estimatedCostUsd ?? 0),
        repoCapUsd: input.repoCapUsd,
        globalCapUsd: input.globalCapUsd,
        nextJobEstimateUsd: input.estimateUsd,
      });
      if (!decision.allowed) return decision;
      const row = await tx.usageEntry.create({
        data: {
          repoId: input.repoId,
          day,
          provider: input.provider,
          model: input.model,
          status: "RESERVED",
          estimatedCostUsd: input.estimateUsd,
          jobId: input.jobId,
        },
      });
      return { allowed: true as const, usageId: row.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function finalizeUsage(input: {
  usageId: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.usageEntry.update({
    where: { id: input.usageId },
    data: {
      status: "FINAL",
      promptTokens: Math.max(0, Math.trunc(input.promptTokens)),
      completionTokens: Math.max(0, Math.trunc(input.completionTokens)),
      estimatedCostUsd: Math.max(0, input.estimatedCostUsd),
    },
  });
}

export async function releaseUsage(usageId: string | undefined): Promise<void> {
  if (!usageId) return;
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.usageEntry.deleteMany({ where: { id: usageId, status: "RESERVED" } });
}

export async function releaseUsageForJob(jobId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.usageEntry.deleteMany({ where: { jobId, status: "RESERVED" } });
}
