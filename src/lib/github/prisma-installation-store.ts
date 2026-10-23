import { getPrisma, isUniqueConstraint } from "@/lib/db";
import type { InstallationStore } from "@/lib/github/link-installation";

export function createPrismaInstallationStore(): InstallationStore | null {
  const prisma = getPrisma();
  if (!prisma) return null;
  return {
    async saveInstallation(input) {
      const installation = await prisma.installation.upsert({
        where: { githubInstallationId: input.githubInstallationId },
        create: {
          githubInstallationId: input.githubInstallationId,
          accountLogin: input.accountLogin,
          accountType: input.accountType,
          userId: input.userId,
        },
        update: {
          accountLogin: input.accountLogin,
          accountType: input.accountType,
          userId: input.userId,
          uninstalledAt: null,
          suspendedAt: null,
        },
        select: { id: true },
      });
      return { id: installation.id };
    },
    async saveRepo(input) {
      const repo = await prisma.repo.upsert({
        where: { githubRepoId: input.githubRepoId },
        create: {
          installationId: input.installationId,
          githubRepoId: input.githubRepoId,
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          private: input.private,
          defaultBranch: input.defaultBranch,
          archived: input.archived,
        },
        update: {
          installationId: input.installationId,
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          private: input.private,
          defaultBranch: input.defaultBranch,
          archived: input.archived,
          removed: false,
        },
        select: { id: true, site: { select: { id: true } } },
      });
      return { id: repo.id, hasSite: Boolean(repo.site) };
    },
    async saveSite(input) {
      const existing = await prisma.site.findUnique({
        where: { repoId: input.repoId },
        select: { id: true },
      });
      if (existing) return "exists";
      try {
        await prisma.site.create({
          data: {
            repoId: input.repoId,
            ownerId: input.ownerId,
            name: input.name,
            subdomain: input.subdomain,
            status: "PENDING",
          },
        });
        return "created";
      } catch (error) {
        if (!isUniqueConstraint(error)) throw error;
        const again = await prisma.site.findUnique({
          where: { repoId: input.repoId },
          select: { id: true },
        });
        return again ? "exists" : "taken";
      }
    },
  };
}
