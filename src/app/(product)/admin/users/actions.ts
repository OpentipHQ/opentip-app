"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { setActAsCookie, signActAs } from "@/lib/admin/act-as";
import { getPrisma } from "@/lib/db";

export async function suspendUser(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/users?error=1");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/admin/users?error=1");
  if (user.id === session.userId) redirect("/admin/users?error=self");
  await prisma.user.update({
    where: { id },
    data: { suspendedAt: new Date(), sessionVersion: { increment: 1 } },
  });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.user-suspend",
    targetType: "user",
    targetId: id,
    metadata: { login: user.login },
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?saved=suspended`);
}

export async function unsuspendUser(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/users?error=1");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/admin/users?error=1");
  await prisma.user.update({ where: { id }, data: { suspendedAt: null } });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.user-unsuspend",
    targetType: "user",
    targetId: id,
    metadata: { login: user.login },
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?saved=active`);
}

export async function startActAs(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/users?error=1");
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, login: true, name: true, role: true },
  });
  if (!target) redirect("/admin/users?error=1");
  const token = await signActAs(session.userId, target);
  if (!token) redirect("/admin/users?error=session");
  await setActAsCookie(token);
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.act-as-start",
    targetType: "user",
    targetId: target.id,
    metadata: { login: target.login },
  });
  redirect("/dashboard");
}
