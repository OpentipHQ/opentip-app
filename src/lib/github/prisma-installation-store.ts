import { getPrisma } from "@/lib/db";
import { installationOwnerUpdate } from "@/lib/github/installation-access";
import type { InstallationStore } from "@/lib/github/link-installation";
import { applyResume } from "@/lib/github/resume";

export function createPrismaInstallationStore(): InstallationStore | null {
  const prisma = getPrisma();
  if (!prisma) return null;
  return {
    async saveInstallation(input) {
      const existing = await prisma.installation.findUnique({
        where: { githubInstallationId: input.githubInstallationId },
        select: { userId: true },
      });
      const decision = installationOwnerUpdate({
        accountType: input.accountType,
        existingUserId: existing?.userId ?? null,
        linkingUserId: input.userId,
      });
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
          ...(decision.userId ? { userId: decision.userId } : {}),
          uninstalledAt: null,
          suspendedAt: null,
        },
        select: { id: true },
      });
      await prisma.installationMember.upsert({
        where: {
          installationId_userId: {
            installationId: installation.id,
            userId: input.userId,
          },
        },
        create: { installationId: installation.id, userId: input.userId },
        update: {},
      });
      const sites = await prisma.site.findMany({
        where: {
          status: "PAUSED",
          pausedReason: { in: ["github_app_uninstalled", "github_app_suspended"] },
          repo: { installationId: installation.id },
        },
        select: {
          id: true,
          pausedReason: true,
          _count: { select: { pages: { where: { published: true } } } },
        },
      });
      await applyResume(
        sites.map((site) => ({
          id: site.id,
          pausedReason: site.pausedReason,
          publishedPageCount: site._count.pages,
        })),
        ["github_app_uninstalled", "github_app_suspended"],
        async (id, status) => {
          await prisma.site.update({ where: { id }, data: { status, pausedReason: null } });
        },
      );
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
      const reasons = ["repo_removed", "repo_deleted", "github_app_uninstalled", "github_app_suspended"];
      if (!input.archived) reasons.push("repo_archived");
      const sites = await prisma.site.findMany({
        where: {
          repoId: repo.id,
          status: "PAUSED",
          pausedReason: { in: reasons },
        },
        select: {
          id: true,
          pausedReason: true,
          _count: { select: { pages: { where: { published: true } } } },
        },
      });
      await applyResume(
        sites.map((site) => ({
          id: site.id,
          pausedReason: site.pausedReason,
          publishedPageCount: site._count.pages,
        })),
        reasons,
        async (id, status) => {
          await prisma.site.update({ where: { id }, data: { status, pausedReason: null } });
        },
      );
      return { id: repo.id };
    },
  };
}
