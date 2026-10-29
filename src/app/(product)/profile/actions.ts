"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { flashToast, redirectWithToast } from "@/lib/toast-server";
import { requireUserAction } from "@/lib/admin/guard";
import { logActivity } from "@/lib/admin/activity";
import { sessionCookieOptions } from "@/lib/auth";
import { issueEmailChangeCode, verifyEmailChangeCode } from "@/lib/auth/email-flow";
import { normalizeEmail } from "@/lib/auth/login-code";
import { getPrisma, isUniqueConstraint } from "@/lib/db";
import { deleteConfirmationMatches, canUnlinkEmail, canUnlinkGithub } from "@/lib/profile/rules";
import {
  ProfileStorageUnconfigured,
  deleteProfileImage,
  uploadProfileImage,
} from "@/lib/profile/storage";
import { SESSION_COOKIE } from "@/lib/session";

function profileUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `/profile?${search.toString()}`;
}

export async function updateDisplayName(formData: FormData) {
  const session = await requireUserAction();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) {
    return redirectWithToast(profileUrl({ error: "name" }), "error", "Enter a display name.");
  }
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  await prisma.user.update({ where: { id: session.userId }, data: { name } });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "profile.name",
    targetType: "user",
    targetId: session.userId,
  });
  revalidatePath("/profile");
  return redirectWithToast(profileUrl({ saved: "name" }), "success", "Name saved.");
}

export async function uploadPicture(formData: FormData) {
  const session = await requireUserAction();
  const file = formData.get("picture");
  if (!(file instanceof File) || file.size === 0) {
    return redirectWithToast(profileUrl({ error: "image" }), "error", "Choose an image to upload.");
  }
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { imageUrl: true },
  });
  try {
    const { url } = await uploadProfileImage({ userId: session.userId, file });
    await prisma.user.update({ where: { id: session.userId }, data: { imageUrl: url } });
    await deleteProfileImage(current?.imageUrl);
  } catch (error) {
    if (error instanceof ProfileStorageUnconfigured) {
      return redirectWithToast(
        profileUrl({ error: "blob" }),
        "error",
        "Image storage is not configured.",
      );
    }
    return redirectWithToast(
      profileUrl({ error: "image" }),
      "error",
      "Could not upload that image. Try another file.",
    );
  }
  revalidatePath("/profile");
  return redirectWithToast(
    profileUrl({ saved: "picture" }),
    "success",
    "Profile picture updated.",
  );
}

export async function removePicture() {
  const session = await requireUserAction();
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { imageUrl: true },
  });
  await prisma.user.update({ where: { id: session.userId }, data: { imageUrl: null } });
  await deleteProfileImage(current?.imageUrl);
  revalidatePath("/profile");
  return redirectWithToast(
    profileUrl({ saved: "picture" }),
    "success",
    "Profile picture removed.",
  );
}

export async function requestEmailChange(formData: FormData) {
  const session = await requireUserAction();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) {
    return redirectWithToast(profileUrl({ error: "email" }), "error", "Enter a valid email address.");
  }
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken && taken.id !== session.userId) {
    return redirectWithToast(
      profileUrl({ error: "email-taken" }),
      "error",
      "That email is already in use.",
    );
  }
  const result = await issueEmailChangeCode({ userId: session.userId, emailRaw: email });
  if (result.status !== "sent") {
    return redirectWithToast(
      profileUrl({ error: result.status === "cooldown" ? "cooldown" : "email-send" }),
      "error",
      result.status === "cooldown"
        ? "Wait before requesting another code."
        : "Could not send the code. Try again.",
    );
  }
  return redirectWithToast(
    profileUrl({ sent: email }),
    "success",
    `Code sent to ${email}.`,
  );
}

export async function confirmEmailChange(formData: FormData) {
  const session = await requireUserAction();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "");
  if (!email) {
    return redirectWithToast(profileUrl({ error: "email" }), "error", "Enter a valid email address.");
  }
  const result = await verifyEmailChangeCode({
    userId: session.userId,
    emailRaw: email,
    code,
  });
  if (result !== "ok") {
    return redirectWithToast(
      profileUrl({ error: result }),
      "error",
      "That code is invalid or expired.",
    );
  }
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.userId },
        data: { email, sessionVersion: { increment: 1 } },
      });
      if (current?.email && current.email !== email) {
        await tx.betaAccess.deleteMany({ where: { email: current.email } });
        const previousPreference = await tx.emailPreference.findUnique({
          where: { email: current.email },
        });
        if (previousPreference) {
          const nextPreference = await tx.emailPreference.findUnique({
            where: { email },
            select: { announcements: true },
          });
          if (nextPreference) {
            await tx.emailPreference.update({
              where: { email },
              data: {
                announcements:
                  nextPreference.announcements && previousPreference.announcements,
              },
            });
          } else {
            await tx.emailPreference.update({
              where: { email: current.email },
              data: { email },
            });
          }
        }
      }
      await tx.betaAccess.upsert({
        where: { email },
        create: { email },
        update: {},
      });
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      return redirectWithToast(
        profileUrl({ error: "email-taken" }),
        "error",
        "That email is already in use.",
      );
    }
    throw error;
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: current?.email ?? session.login,
    action: "profile.email-change",
    targetType: "user",
    targetId: session.userId,
    metadata: { to: email },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  await flashToast("success", "Email changed. Sign in again.");
  redirect("/login?email=changed");
}

export async function unlinkGithub() {
  const session = await requireUserAction();
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { githubId: true, email: true, emailSignInEnabled: true },
  });
  if (!user || !user.githubId || !canUnlinkGithub(user)) {
    return redirectWithToast(
      profileUrl({ error: "last-method" }),
      "error",
      "Keep at least one sign-in method connected.",
    );
  }
  await prisma.user.update({ where: { id: session.userId }, data: { githubId: null } });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "profile.github-unlink",
    targetType: "user",
    targetId: session.userId,
  });
  revalidatePath("/profile");
  return redirectWithToast(
    profileUrl({ saved: "github-unlinked" }),
    "success",
    "GitHub disconnected.",
  );
}

export async function unlinkEmail() {
  const session = await requireUserAction();
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { githubId: true, email: true, emailSignInEnabled: true },
  });
  if (!user || !user.email || !canUnlinkEmail(user)) {
    return redirectWithToast(
      profileUrl({ error: "last-method" }),
      "error",
      "Keep at least one sign-in method connected.",
    );
  }
  await prisma.user.update({
    where: { id: session.userId },
    data: { emailSignInEnabled: false },
  });
  await logActivity({
    actorId: session.userId,
    actorEmail: user.email,
    action: "profile.email-unlink",
    targetType: "user",
    targetId: session.userId,
  });
  revalidatePath("/profile");
  return redirectWithToast(
    profileUrl({ saved: "email-unlinked" }),
    "success",
    "Email sign-in disabled.",
  );
}

export async function signOutEverywhere() {
  const session = await requireUserAction();
  const prisma = getPrisma();
  if (prisma) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  await flashToast("success", "Signed out everywhere.");
  redirect("/login?signed-out=all");
}

export async function deleteAccount(formData: FormData) {
  const session = await requireUserAction();
  const typed = String(formData.get("confirm") ?? "");
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      profileUrl({ error: "database" }),
      "error",
      "The database is not connected.",
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { login: true, email: true, imageUrl: true },
  });
  if (!user || !deleteConfirmationMatches(typed, user.login)) {
    return redirectWithToast(
      profileUrl({ error: "confirm" }),
      "error",
      "Type your username exactly to confirm.",
    );
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: user.email ?? user.login,
    action: "profile.account-delete",
    targetType: "user",
    targetId: session.userId,
    metadata: { login: user.login, email: user.email },
  });
  await prisma.$transaction([
    ...(user.email
      ? [prisma.emailPreference.deleteMany({ where: { email: user.email } })]
      : []),
    prisma.user.delete({ where: { id: session.userId } }),
  ]);
  await deleteProfileImage(user.imageUrl);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  await flashToast("success", "Your account was deleted.");
  redirect("/");
}
