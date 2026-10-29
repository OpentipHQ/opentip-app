"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";
import { redirectWithToast } from "@/lib/toast-server";

export async function changeUserPlan(formData: FormData) {
  const session = await requireWritableAdminAction();
  const userId = String(formData.get("userId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const prisma = getPrisma();
  if (!prisma || !userId || !planId) {
    return redirectWithToast(
      "/admin/plans?error=1",
      "error",
      "Choose a user and a plan.",
    );
  }
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ]);
  if (!user || !plan) {
    return redirectWithToast(
      "/admin/plans?error=1",
      "error",
      "That user or plan no longer exists.",
    );
  }
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, planId, status: "beta" },
    update: { planId, status: "beta" },
  });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.plan-change",
    targetType: "user",
    targetId: userId,
    metadata: { login: user.login, plan: plan.tier },
  });
  revalidatePath("/admin/plans");
  return redirectWithToast("/admin/plans?saved=plan", "success", "Plan updated.");
}

export async function addCredits(formData: FormData) {
  const session = await requireWritableAdminAction();
  const userId = String(formData.get("userId") ?? "");
  const raw = Number(formData.get("amount") ?? 0);
  const amount = Number.isFinite(raw) ? Math.round(raw * 10000) / 10000 : 0;
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      "/admin/plans?error=1",
      "error",
      "The database is not connected.",
    );
  }
  if (!userId || amount === 0 || Math.abs(amount) > 100000) {
    return redirectWithToast(
      "/admin/plans?error=1",
      "error",
      "Choose a user and enter a non-zero amount.",
    );
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return redirectWithToast(
      "/admin/plans?error=1",
      "error",
      "That user no longer exists.",
    );
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { creditUsd: { increment: amount } },
    select: { creditUsd: true },
  });
  if (Number(updated.creditUsd) < 0) {
    await prisma.user.update({ where: { id: userId }, data: { creditUsd: 0 } });
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.credits-add",
    targetType: "user",
    targetId: userId,
    metadata: { login: user.login, amount },
  });
  revalidatePath("/admin/plans");
  return redirectWithToast("/admin/plans?saved=credits", "success", "Credits updated.");
}
