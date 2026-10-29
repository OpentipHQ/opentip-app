import { JobPhase, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";

export type JobEventInput = {
  jobId: string;
  level?: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
  phase?: JobPhase;
  progress?: number;
  detail?: string | null;
};

export async function logJobEvent(input: JobEventInput): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_URL is required to run a job.");
  await prisma.$transaction(async (tx) => {
    const last = await tx.jobEvent.findFirst({
      where: { jobId: input.jobId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    await tx.jobEvent.create({
      data: {
        jobId: input.jobId,
        sequence: (last?.sequence ?? 0) + 1,
        level: input.level ?? "info",
        message: input.message.slice(0, 2_000),
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
    if (
      input.phase !== undefined ||
      input.progress !== undefined ||
      input.detail !== undefined
    ) {
      await tx.job.update({
        where: { id: input.jobId },
        data: {
          phase: input.phase,
          progress:
            input.progress === undefined
              ? undefined
              : Math.max(0, Math.min(100, Math.trunc(input.progress))),
          detail: input.detail,
        },
      });
    }
  });
}

export { JobPhase };
