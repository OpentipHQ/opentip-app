import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import type { PendingSnapshot } from "@/lib/auth/gate";
import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";
import { PENDING_INSTALL_TTL_SECONDS } from "@/lib/auth/constants";

export function hashSelector(selector: string): string {
  return createHash("sha256").update(selector).digest("hex");
}

export function newInstallSelector(): string {
  return randomBytes(32).toString("hex");
}

function asInstallation(value: unknown): VerifiedInstallation | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<VerifiedInstallation>;
  if (!row.githubInstallationId || !row.accountLogin) return null;
  return {
    githubInstallationId: String(row.githubInstallationId),
    accountLogin: String(row.accountLogin),
    accountType: row.accountType ? String(row.accountType) : "User",
  };
}

function asRepos(value: unknown): RepoSeed[] {
  if (!Array.isArray(value)) return [];
  const repos: RepoSeed[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const repo = item as Partial<RepoSeed>;
    if (!repo.githubRepoId || !repo.owner || !repo.name) continue;
    repos.push({
      githubRepoId: String(repo.githubRepoId),
      owner: String(repo.owner),
      name: String(repo.name),
      fullName: repo.fullName ? String(repo.fullName) : `${repo.owner}/${repo.name}`,
      private: repo.private === true,
      defaultBranch: repo.defaultBranch ? String(repo.defaultBranch) : "main",
      archived: repo.archived === true,
    });
  }
  return repos;
}

export async function storePendingInstall(snapshot: PendingSnapshot): Promise<string> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database");
  const selector = newInstallSelector();
  await prisma.pendingInstall.create({
    data: {
      selectorHash: hashSelector(selector),
      githubUserId: snapshot.githubUserId,
      email: snapshot.email,
      login: snapshot.login,
      name: snapshot.name,
      avatarUrl: snapshot.avatarUrl,
      installationJson: snapshot.installation,
      reposJson: snapshot.repos,
      expiresAt: new Date(Date.now() + PENDING_INSTALL_TTL_SECONDS * 1000),
    },
  });
  return selector;
}

export async function readPendingInstall(selector: string | null | undefined): Promise<{
  id: string;
  snapshot: PendingSnapshot;
} | null> {
  if (!selector) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const row = await prisma.pendingInstall.findUnique({
    where: { selectorHash: hashSelector(selector) },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) return null;
  const installation = asInstallation(row.installationJson);
  if (!installation) return null;
  return {
    id: row.id,
    snapshot: {
      githubUserId: row.githubUserId,
      email: row.email,
      login: row.login,
      name: row.name,
      avatarUrl: row.avatarUrl,
      installation,
      repos: asRepos(row.reposJson),
    },
  };
}

export async function consumePendingInstall(id: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.pendingInstall.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}
