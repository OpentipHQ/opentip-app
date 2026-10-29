import { getPrisma } from "@/lib/db";
import { DEFAULT_HEAVY_MODEL } from "@/lib/copilot/models";
import type { ImportStore } from "@/lib/import/repo-import";

export function createPrismaImportStore(): ImportStore | null {
  const prisma = getPrisma();
  if (!prisma) return null;
  return {
    async findRepoForUser(repoId, userId) {
      const repo = await prisma.repo.findFirst({
        where: {
          id: repoId,
          installation: {
            userId,
            uninstalledAt: null,
            suspendedAt: null,
          },
        },
        select: {
          id: true,
          githubRepoId: true,
          owner: true,
          name: true,
          fullName: true,
          archived: true,
          removed: true,
          site: { select: { id: true } },
        },
      });
      if (!repo) return null;
      return {
        id: repo.id,
        githubRepoId: repo.githubRepoId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        archived: repo.archived,
        removed: repo.removed,
        siteId: repo.site?.id ?? null,
      };
    },
    async subdomainTaken(subdomain) {
      const row = await prisma.site.findUnique({
        where: { subdomain },
        select: { id: true },
      });
      return Boolean(row);
    },
    async createSiteAndJob(input) {
      return prisma.$transaction(async (tx) => {
        const site = await tx.site.create({
          data: {
            repoId: input.repoId,
            ownerId: input.userId,
            name: input.name,
            subdomain: input.subdomain,
            description: input.description,
            theme: input.theme,
            primaryColor: input.primaryColor,
            reviewMode: input.reviewMode,
            status: "PENDING",
          },
          select: { id: true },
        });
        const job = await tx.job.create({
          data: {
            repoId: input.repoId,
            kind: "FIRST_BUILD",
            status: "QUEUED",
            provider: "XAI",
            model: DEFAULT_HEAVY_MODEL,
            idempotencyKey: input.idempotencyKey,
            payload: { source: "import" },
          },
          select: { id: true },
        });
        return { siteId: site.id, jobId: job.id };
      });
    },
  };
}
