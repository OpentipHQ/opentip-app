import { getPrisma } from "@/lib/db";
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
          accountAvatarUrl: input.accountAvatarUrl ?? null,
          userId: input.userId,
        },
        update: {
          accountLogin: input.accountLogin,
          accountType: input.accountType,
          accountAvatarUrl: input.accountAvatarUrl ?? null,
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
          pushedAt: input.pushedAt ?? null,
        },
        update: {
          installationId: input.installationId,
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          private: input.private,
          defaultBranch: input.defaultBranch,
          archived: input.archived,
          pushedAt: input.pushedAt ?? null,
          removed: false,
        },
        select: { id: true },
      });
      return { id: repo.id };
    },
  };
}
