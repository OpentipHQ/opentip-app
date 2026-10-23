import { getPrisma, isUniqueConstraint } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/login-code";

export async function hasBetaAccess(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const prisma = getPrisma();
  if (!prisma) return false;
  const row = await prisma.betaAccess.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  return Boolean(row);
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
