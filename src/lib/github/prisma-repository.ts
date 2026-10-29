import { Prisma } from "@/generated/prisma/client";
import { getPrisma, isUniqueConstraint } from "@/lib/db";
import { applyResume } from "@/lib/github/resume";
import type { NewJob, WebhookRepository } from "@/lib/github/types";

export function createPrismaWebhookRepository(): WebhookRepository | null {
  const prisma = getPrisma();
  if (!prisma) return null;

  return {
    async claimDelivery(input) {
      try {
        await prisma.webhookDelivery.create({
          data: {
            id: input.id,
            event: input.event,
            action: input.action,
          },
        });
        return true;
      } catch (error) {
        if (isUniqueConstraint(error)) return false;
        throw error;
      }
    },
    async finishDelivery(id, jobId) {
      await prisma.webhookDelivery.update({
        where: { id },
        data: { jobId },
      });
    },
    async releaseDelivery(id) {
      await prisma.webhookDelivery.deleteMany({ where: { id } });
    },
    async findRepoByGithubId(githubRepoId) {
      const repo = await prisma.repo.findUnique({
        where: { githubRepoId },
        include: {
          installation: true,
          site: { select: { status: true } },
        },
      });
      if (!repo) return null;
      return {
        id: repo.id,
        githubRepoId: repo.githubRepoId,
        fullName: repo.fullName,
        owner: repo.owner,
        name: repo.name,
        installationGithubId: repo.installation.githubInstallationId,
        defaultBranch: repo.defaultBranch,
        siteStatus: repo.site?.status ?? null,
      };
    },
    async enqueueJob(job: NewJob) {
      try {
        const created = await prisma.job.create({
          data: {
            repoId: job.repoId,
            kind: job.kind,
            status: "QUEUED",
            provider: job.provider,
            model: job.model,
            idempotencyKey: job.idempotencyKey,
            deliveryId: job.deliveryId,
            payload: job.payload as Prisma.InputJsonValue,
          },
        });
        return { id: created.id, created: true };
      } catch (error) {
        if (!isUniqueConstraint(error)) throw error;
        const existing = await prisma.job.findUnique({
          where: { idempotencyKey: job.idempotencyKey },
        });
        if (!existing) throw error;
        return { id: existing.id, created: false };
      }
    },
    async pauseInstallation(githubInstallationId, reason) {
      const now = new Date();
      await prisma.installation.updateMany({
        where: { githubInstallationId },
        data: {
          uninstalledAt: reason === "github_app_uninstalled" ? now : undefined,
          suspendedAt: reason === "github_app_suspended" ? now : undefined,
        },
      });
      const repos = await prisma.repo.findMany({
        where: { installation: { githubInstallationId } },
        select: { id: true },
      });
      const paused = await prisma.site.updateMany({
        where: {
          repoId: { in: repos.map((repo) => repo.id) },
          status: { not: "PAUSED" },
        },
        data: { status: "PAUSED", pausedReason: reason },
      });
      return paused.count;
    },
    async pauseRepos(githubRepoIds, reason) {
      const repos = await prisma.repo.findMany({
        where: { githubRepoId: { in: githubRepoIds } },
        select: { id: true },
      });
      if (reason === "repo_removed" || reason === "repo_deleted") {
        await prisma.repo.updateMany({
          where: { githubRepoId: { in: githubRepoIds } },
          data: { removed: true },
        });
      }
      const paused = await prisma.site.updateMany({
        where: {
          repoId: { in: repos.map((repo) => repo.id) },
          status: { not: "PAUSED" },
        },
        data: { status: "PAUSED", pausedReason: reason },
      });
      return paused.count;
    },
    async resumeInstallation(githubInstallationId, reasons) {
      await prisma.installation.updateMany({
        where: { githubInstallationId },
        data: { uninstalledAt: null, suspendedAt: null },
      });
      const sites = await prisma.site.findMany({
        where: {
          status: "PAUSED",
          pausedReason: { in: reasons },
          repo: { installation: { githubInstallationId } },
        },
        select: {
          id: true,
          pausedReason: true,
          _count: { select: { pages: { where: { published: true } } } },
        },
      });
      return applyResume(
        sites.map((site) => ({
          id: site.id,
          pausedReason: site.pausedReason,
          publishedPageCount: site._count.pages,
        })),
        reasons,
        async (id, status) => {
          await prisma.site.update({
            where: { id },
            data: { status, pausedReason: null },
          });
        },
      );
    },
    async resumeRepos(githubRepoIds, reasons) {
      if (githubRepoIds.length === 0) return 0;
      const sites = await prisma.site.findMany({
        where: {
          status: "PAUSED",
          pausedReason: { in: reasons },
          repo: { githubRepoId: { in: githubRepoIds } },
        },
        select: {
          id: true,
          pausedReason: true,
          _count: { select: { pages: { where: { published: true } } } },
        },
      });
      return applyResume(
        sites.map((site) => ({
          id: site.id,
          pausedReason: site.pausedReason,
          publishedPageCount: site._count.pages,
        })),
        reasons,
        async (id, status) => {
          await prisma.site.update({
            where: { id },
            data: { status, pausedReason: null },
          });
        },
      );
    },
    async addRepos(githubInstallationId, repos) {
      const installation = await prisma.installation.findUnique({
        where: { githubInstallationId },
        select: { id: true },
      });
      if (!installation) return 0;
      let added = 0;
      for (const repo of repos) {
        await prisma.repo.upsert({
          where: { githubRepoId: repo.githubRepoId },
          create: {
            installationId: installation.id,
            githubRepoId: repo.githubRepoId,
            owner: repo.owner,
            name: repo.name,
            fullName: repo.fullName,
            private: repo.private,
            defaultBranch: repo.defaultBranch,
            archived: repo.archived,
            pushedAt: repo.pushedAt ?? null,
          },
          update: {
            installationId: installation.id,
            owner: repo.owner,
            name: repo.name,
            fullName: repo.fullName,
            private: repo.private,
            defaultBranch: repo.defaultBranch,
            archived: repo.archived,
            pushedAt: repo.pushedAt ?? null,
            removed: false,
          },
        });
        added += 1;
      }
      return added;
    },
    async recordError(input) {
      await prisma.webhookError.create({ data: input });
    },
    async upsertInstallation(input) {
      await prisma.installation.upsert({
        where: { githubInstallationId: input.githubInstallationId },
        create: {
          githubInstallationId: input.githubInstallationId,
          accountLogin: input.accountLogin,
          accountType: input.accountType,
        },
        update: {
          accountLogin: input.accountLogin,
          accountType: input.accountType,
          uninstalledAt: null,
          suspendedAt: null,
        },
      });
    },
    async applyRepositoryChange(input) {
      const repo = await prisma.repo.findUnique({
        where: { githubRepoId: input.githubRepoId },
      });
      if (!repo) return 0;
      if (input.action === "renamed" || input.action === "transferred") {
        await prisma.repo.update({
          where: { id: repo.id },
          data: {
            owner: input.owner ?? repo.owner,
            name: input.name ?? repo.name,
            fullName: input.fullName ?? repo.fullName,
          },
        });
      }
      if (input.action === "archived") {
        await prisma.repo.update({
          where: { id: repo.id },
          data: { archived: true },
        });
        return this.pauseRepos([input.githubRepoId], "repo_archived");
      }
      if (input.action === "deleted") {
        return this.pauseRepos([input.githubRepoId], "repo_deleted");
      }
      if (input.action === "transferred") {
        return this.pauseRepos([input.githubRepoId], "repo_transferred");
      }
      if (input.action === "unarchived") {
        await prisma.repo.update({
          where: { id: repo.id },
          data: { archived: false },
        });
        return this.resumeRepos([input.githubRepoId], ["repo_archived"]);
      }
      return 0;
    },
  };
}
