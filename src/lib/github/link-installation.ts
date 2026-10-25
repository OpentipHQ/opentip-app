import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";

export type InstallationStore = {
  saveInstallation(
    input: VerifiedInstallation & { userId: string },
  ): Promise<{ id: string }>;
  saveRepo(input: RepoSeed & { installationId: string }): Promise<{ id: string }>;
};

export async function linkInstallationRecords(
  store: InstallationStore,
  args: { userId: string; installation: VerifiedInstallation; repos: RepoSeed[] },
): Promise<{ sitesCreated: number }> {
  const saved = await store.saveInstallation({ ...args.installation, userId: args.userId });
  for (const repo of args.repos) {
    await store.saveRepo({ ...repo, installationId: saved.id });
  }
  return { sitesCreated: 0 };
}
