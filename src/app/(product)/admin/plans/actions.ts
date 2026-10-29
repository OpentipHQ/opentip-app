"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { adjustCredits } from "@/lib/credits/apply";
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
  const mode = String(formData.get("mode") ?? "grant") === "remove" ? "remove" : "grant";
  const credits = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "");
  const result = await adjustCredits({
    userId,
    actorId: session.userId,
    mode,
    credits,
    reason,
  });
  if (!result.ok) {
    return redirectWithToast("/admin/plans?error=1", "error", result.error);
  }
  const prisma = getPrisma();
  const user = prisma
    ? await prisma.user.findUnique({ where: { id: userId }, select: { login: true } })
    : null;
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: mode === "grant" ? "admin.credits-grant" : "admin.credits-remove",
    targetType: "user",
    targetId: userId,
    metadata: { login: user?.login ?? userId, credits, reason: reason.trim(), balance: result.balance },
  });
  revalidatePath("/admin/plans");
  revalidatePath("/admin/credits");
  revalidatePath(`/admin/users/${userId}`);
  return redirectWithToast("/admin/plans?saved=credits", "success", "Credits updated.");
}
