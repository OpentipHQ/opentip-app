import { getPrisma, isUniqueConstraint } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/login-code";
import { isBootstrapAdmin } from "@/lib/beta/admins";

export async function hasBetaAccess(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isBootstrapAdmin(normalized)) return true;
  const prisma = getPrisma();
  if (!prisma) return false;
  const row = await prisma.betaAccess.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  return Boolean(row);
}

export async function findBetaAccessEmails(emails: string[]): Promise<Set<string>> {
  const normalized = Array.from(
    new Set(
      emails
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email)),
    ),
  );
  const approved = new Set(normalized.filter((email) => isBootstrapAdmin(email)));
  const prisma = getPrisma();
  if (!prisma || normalized.length === 0) return approved;
  const rows = await prisma.betaAccess.findMany({
    where: { email: { in: normalized } },
    select: { email: true },
  });
  for (const row of rows) approved.add(row.email);
  return approved;
}

export async function revokeBetaAccess(
  email: string,
): Promise<"revoked" | "invalid" | "no-database" | "bootstrap"> {
  const normalized = normalizeEmail(email);
  if (!normalized) return "invalid";
  if (isBootstrapAdmin(normalized)) return "bootstrap";
  const prisma = getPrisma();
  if (!prisma) return "no-database";
  await prisma.$transaction([
    prisma.betaAccess.deleteMany({ where: { email: normalized } }),
    prisma.user.updateMany({
      where: { email: normalized },
      data: { sessionVersion: { increment: 1 } },
    }),
  ]);
  return "revoked";
}

export async function grantBetaAccess(
  email: string,
  applicationId?: string | null,
): Promise<"granted" | "invalid" | "no-database"> {
  const normalized = normalizeEmail(email);
  if (!normalized) return "invalid";
  const prisma = getPrisma();
  if (!prisma) return "no-database";
  try {
    await prisma.betaAccess.upsert({
      where: { email: normalized },
      create: {
        email: normalized,
        applicationId: applicationId ?? null,
      },
      update: applicationId ? { applicationId } : {},
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    await prisma.betaAccess.upsert({
      where: { email: normalized },
      create: { email: normalized },
      update: {},
    });
  }
  return "granted";
}
