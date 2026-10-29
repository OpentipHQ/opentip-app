"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { setActAsCookie, signActAs } from "@/lib/admin/act-as";
import { getPrisma } from "@/lib/db";
import { redirectWithToast } from "@/lib/toast-server";

export async function suspendUser(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) {
    return redirectWithToast("/admin/users?error=1", "error", "That user could not be suspended.");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return redirectWithToast("/admin/users?error=1", "error", "That user no longer exists.");
  }
  if (user.id === session.userId) {
    return redirectWithToast("/admin/users?error=self", "error", "You cannot suspend yourself.");
  }
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
  return redirectWithToast(
    `/admin/users/${id}?saved=suspended`,
    "success",
    `${user.login} was suspended.`,
  );
}

export async function unsuspendUser(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) {
    return redirectWithToast("/admin/users?error=1", "error", "That user could not be restored.");
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return redirectWithToast("/admin/users?error=1", "error", "That user no longer exists.");
  }
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
  return redirectWithToast(
    `/admin/users/${id}?saved=active`,
    "success",
    `${user.login} was restored.`,
  );
}

export async function startActAs(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) {
    return redirectWithToast("/admin/users?error=1", "error", "That user could not be opened.");
  }
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, login: true, name: true, role: true },
  });
  if (!target) {
    return redirectWithToast("/admin/users?error=1", "error", "That user no longer exists.");
  }
  const token = await signActAs(session.userId, target);
  if (!token) {
    return redirectWithToast(
      "/admin/users?error=session",
      "error",
      "Your session expired. Sign in again.",
    );
  }
  await setActAsCookie(token);
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.act-as-start",
    targetType: "user",
    targetId: target.id,
    metadata: { login: target.login },
  });
  return redirectWithToast(
    "/dashboard?acting-as=1",
    "success",
    `Viewing as ${target.name || target.login}. Read-only.`,
  );
}
