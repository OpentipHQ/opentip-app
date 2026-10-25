"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";

export async function changeUserPlan(formData: FormData) {
  const session = await requireWritableAdminAction();
  const userId = String(formData.get("userId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const prisma = getPrisma();
  if (!prisma || !userId || !planId) redirect("/admin/plans?error=1");
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.plan.findUnique({ where: { id: planId } }),
  ]);
  if (!user || !plan) redirect("/admin/plans?error=1");
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
  redirect("/admin/plans?saved=plan");
}

export async function addCredits(formData: FormData) {
  const session = await requireWritableAdminAction();
  const userId = String(formData.get("userId") ?? "");
  const raw = Number(formData.get("amount") ?? 0);
  const amount = Number.isFinite(raw) ? Math.round(raw * 10000) / 10000 : 0;
  const prisma = getPrisma();
  if (!prisma || !userId || amount === 0 || Math.abs(amount) > 100000) {
    redirect("/admin/plans?error=1");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/admin/plans?error=1");
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
  redirect("/admin/plans?saved=credits");
}
