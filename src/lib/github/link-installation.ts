import { subdomainCandidates } from "@/lib/github/subdomain";
import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";

export type InstallationStore = {
  saveInstallation(
    input: VerifiedInstallation & { userId: string },
  ): Promise<{ id: string }>;
  saveRepo(input: RepoSeed & { installationId: string }): Promise<{ id: string; hasSite: boolean }>;
  saveSite(input: {
    repoId: string;
    ownerId: string;
    name: string;
    subdomain: string;
  }): Promise<"created" | "exists" | "taken">;
};

export async function linkInstallationRecords(
  store: InstallationStore,
  args: { userId: string; installation: VerifiedInstallation; repos: RepoSeed[] },
): Promise<{ sitesCreated: number }> {
  const saved = await store.saveInstallation({ ...args.installation, userId: args.userId });
  let sitesCreated = 0;
  for (const repo of args.repos) {
    const row = await store.saveRepo({ ...repo, installationId: saved.id });
    if (row.hasSite) continue;
    for (const subdomain of subdomainCandidates(repo.owner, repo.name, repo.githubRepoId)) {
      const result = await store.saveSite({
        repoId: row.id,
        ownerId: args.userId,
        name: repo.name,
        subdomain,
      });
      if (result === "created") {
        sitesCreated += 1;
        break;
      }
      if (result === "exists") break;
    }
  }
  return { sitesCreated };
}
