import { getPrisma, isUniqueConstraint } from "@/lib/db";
import type { AccountProfile, ExistingUser } from "@/lib/auth/accounts";
import { linkInstallationRecords } from "@/lib/github/link-installation";
import { createPrismaInstallationStore } from "@/lib/github/prisma-installation-store";
import type { RepoSeed, VerifiedInstallation } from "@/lib/github/install";

type UserRow = {
  id: string;
  githubId: string | null;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
};

export function toExistingUser(row: UserRow): ExistingUser {
  return {
    id: row.id,
    githubId: row.githubId,
    login: row.login,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    role: row.role,
  };
}

export async function findUserByGithubId(githubId: string): Promise<ExistingUser | null> {
  if (!githubId) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const row = await prisma.user.findUnique({ where: { githubId } });
  return row ? toExistingUser(row) : null;
}

export async function findUserByEmail(email: string): Promise<ExistingUser | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const row = await prisma.user.findUnique({ where: { email } });
  return row ? toExistingUser(row) : null;
}

export async function createAppUser(profile: AccountProfile): Promise<ExistingUser> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database");
  try {
    const row = await prisma.user.create({
      data: {
        githubId: profile.githubId,
        login: profile.login,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      },
    });
    return toExistingUser(row);
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const existing = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!existing) throw error;
    if (existing.githubId && profile.githubId && existing.githubId !== profile.githubId) {
      throw error;
    }
    return toExistingUser(existing);
  }
}

export async function updateAppUser(id: string, profile: AccountProfile): Promise<ExistingUser> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database");
  const row = await prisma.user.update({
    where: { id },
    data: {
      githubId: profile.githubId,
      login: profile.login,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    },
  });
  return toExistingUser(row);
}

export async function linkInstallForUser(
  userId: string,
  installation: VerifiedInstallation,
  repos: RepoSeed[],
): Promise<{ sitesCreated: number }> {
  const store = createPrismaInstallationStore();
  if (!store) return { sitesCreated: 0 };
  return linkInstallationRecords(store, { userId, installation, repos });
}
