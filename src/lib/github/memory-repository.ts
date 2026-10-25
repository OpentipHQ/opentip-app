import type { KnownRepo, NewJob, WebhookRepository } from "@/lib/github/types";

type SiteRow = {
  repoGithubId: string;
  installationGithubId: string;
  status: "PENDING" | "ACTIVE" | "PAUSED";
  pausedReason: string | null;
};

type DeliveryRow = {
  id: string;
  event: string;
  action: string | null;
  jobId: string | null;
};

export class MemoryWebhookRepository implements WebhookRepository {
  deliveries = new Map<string, DeliveryRow>();
  jobs: Array<NewJob & { id: string }> = [];
  repos = new Map<string, KnownRepo>();
  sites: SiteRow[] = [];
  installations = new Map<
    string,
    { accountLogin: string; accountType: string; uninstalled: boolean }
  >();
  failEnqueueOnce = false;

  async claimDelivery(input: {
    id: string;
    event: string;
    action: string | null;
  }): Promise<boolean> {
    if (this.deliveries.has(input.id)) return false;
    this.deliveries.set(input.id, { ...input, jobId: null });
    return true;
  }

  async finishDelivery(id: string, jobId: string | null): Promise<void> {
    const row = this.deliveries.get(id);
    if (row) row.jobId = jobId;
  }

  async releaseDelivery(id: string): Promise<void> {
    this.deliveries.delete(id);
  }

  async findRepoByGithubId(githubRepoId: string): Promise<KnownRepo | null> {
    return this.repos.get(githubRepoId) ?? null;
  }

  async enqueueJob(job: NewJob): Promise<{ id: string; created: boolean }> {
    if (this.failEnqueueOnce) {
      this.failEnqueueOnce = false;
      throw new Error("enqueue failed");
    }
    const existing = this.jobs.find(
      (row) => row.idempotencyKey === job.idempotencyKey,
    );
    if (existing) return { id: existing.id, created: false };
    const id = `job_${this.jobs.length + 1}`;
    this.jobs.push({ ...job, id });
    return { id, created: true };
  }

  async pauseInstallation(
    githubInstallationId: string,
    reason: string,
  ): Promise<number> {
    const installation = this.installations.get(githubInstallationId);
    if (installation) installation.uninstalled = true;
    let paused = 0;
    for (const site of this.sites) {
      if (site.installationGithubId !== githubInstallationId) continue;
      if (site.status !== "PAUSED") paused += 1;
      site.status = "PAUSED";
      site.pausedReason = reason;
    }
    return paused;
  }

  async pauseRepos(githubRepoIds: string[], reason: string): Promise<number> {
    const wanted = new Set(githubRepoIds);
    let paused = 0;
    for (const site of this.sites) {
      if (!wanted.has(site.repoGithubId)) continue;
      if (site.status !== "PAUSED") paused += 1;
      site.status = "PAUSED";
      site.pausedReason = reason;
    }
    return paused;
  }

  async addRepos(
    githubInstallationId: string,
    repos: Array<{
      githubRepoId: string;
      owner: string;
      name: string;
      fullName: string;
      private: boolean;
      defaultBranch: string;
      archived: boolean;
      pushedAt?: Date | null;
    }>,
  ): Promise<number> {
    let added = 0;
    for (const repo of repos) {
      this.repos.set(repo.githubRepoId, {
        id: `repo_${repo.githubRepoId}`,
        githubRepoId: repo.githubRepoId,
        fullName: repo.fullName,
        owner: repo.owner,
        name: repo.name,
        installationGithubId: githubInstallationId,
      });
      added += 1;
    }
    return added;
  }

  async recordError(): Promise<void> {}

  async upsertInstallation(input: {
    githubInstallationId: string;
    accountLogin: string;
    accountType: string;
  }): Promise<void> {
    this.installations.set(input.githubInstallationId, {
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      uninstalled: false,
    });
  }

  async applyRepositoryChange(input: {
    githubRepoId: string;
    action: string;
    owner?: string;
    name?: string;
    fullName?: string;
  }): Promise<number> {
    const repo = this.repos.get(input.githubRepoId);
    if (repo) {
      if (input.owner) repo.owner = input.owner;
      if (input.name) repo.name = input.name;
      if (input.fullName) repo.fullName = input.fullName;
    }
    if (input.action === "archived") {
      return this.pauseRepos([input.githubRepoId], "repo_archived");
    }
    if (input.action === "deleted") {
      return this.pauseRepos([input.githubRepoId], "repo_deleted");
    }
    if (input.action === "transferred") {
      return this.pauseRepos([input.githubRepoId], "repo_transferred");
    }
    return 0;
  }
}
