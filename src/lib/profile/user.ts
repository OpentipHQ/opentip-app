import { getPrisma } from "@/lib/db";
import type { Session } from "@/lib/session";

export type CurrentUser = {
  id: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  imageUrl: string | null;
  role: "USER" | "ADMIN";
  emailSignInEnabled: boolean;
  githubId: string | null;
  creditUsd: number;
  suspendedAt: Date | null;
};

export async function loadCurrentUser(session: Session): Promise<CurrentUser> {
  const fallback: CurrentUser = {
    id: session.userId,
    login: session.login,
    name: session.name,
    email: null,
    avatarUrl: null,
    imageUrl: null,
    role: session.role,
    emailSignInEnabled: true,
    githubId: null,
    creditUsd: 0,
    suspendedAt: null,
  };
  const prisma = getPrisma();
  if (!prisma) return fallback;
  const row = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      login: true,
      name: true,
      email: true,
      avatarUrl: true,
      imageUrl: true,
      role: true,
      emailSignInEnabled: true,
      githubId: true,
      creditUsd: true,
      suspendedAt: true,
    },
  });
  if (!row) return fallback;
  return { ...row, creditUsd: Number(row.creditUsd) };
}
