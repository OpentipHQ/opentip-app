"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { normalizeEmail } from "@/lib/auth/login-code";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { grantBetaAccess, revokeBetaAccess } from "@/lib/beta/access";
import {
  approveMarketingApplication,
  loadMarketingApplication,
  rejectMarketingApplication,
} from "@/lib/beta/marketing-db";
import { isMarketingApplicationId } from "@/lib/beta/marketing-applications";
import { appUrl } from "@/lib/config";
import { sendBetaApprovalEmail } from "@/lib/email/resend";
import {
  approveBetaApplication,
  rejectBetaApplication,
  revokeBetaApplicationAccess,
  type ReviewResult,
} from "@/lib/beta/review";
import type { Session } from "@/lib/session";

const reviewDeps = {
  marketing: {
    get: loadMarketingApplication,
    approve: approveMarketingApplication,
    reject: rejectMarketingApplication,
  },
  access: {
    grant: grantBetaAccess,
    revoke: revokeBetaAccess,
  },
  notify: {
    approval: sendApprovalEmail,
  },
};

async function sendApprovalEmail(email: string): Promise<"sent" | "skipped"> {
  const result = await sendBetaApprovalEmail({
    to: email,
    loginUrl: `${appUrl()}/login`,
  });
  return result.delivered ? "sent" : "skipped";
}

function applicationReturnPath(formData: FormData, id: string): string {
  const value = String(formData.get("returnTo") ?? "");
  if (value === "/admin/applications" || value === `/admin/applications/${id}`) return value;
  return `/admin/applications/${id}`;
}

function withParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function revalidateApplications(id: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
}

async function logReview(
  session: Session,
  result: ReviewResult,
  action: string,
): Promise<void> {
  if (!result.applicationId || !result.email) return;
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action,
    targetType: "marketingBetaApplication",
    targetId: result.applicationId,
    metadata: {
      email: result.email,
      partial: !result.ok,
      ...(result.ok ? {} : { reason: result.reason }),
      ...(result.ok && result.approvalEmail
        ? { approvalEmail: result.approvalEmail }
        : {}),
    },
  });
}

export async function approveApplication(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  if (!isMarketingApplicationId(id)) redirect("/admin/applications?error=invalid");
  const returnTo = applicationReturnPath(formData, id);

  const result = await approveBetaApplication(
    { id, reviewer: session.login },
    reviewDeps,
  );
  if (result.ok || result.reason === "partial-approve") {
    await logReview(session, result, "admin.application-approve");
  }

  if (!result.ok) {
    redirect(withParam(returnTo, "error", result.reason));
  }

  revalidateApplications(id);
  const approvedPath = withParam(returnTo, "approved", "1");
  redirect(
    result.approvalEmail
      ? withParam(approvedPath, "invite", result.approvalEmail)
      : approvedPath,
  );
}

export async function rejectApplication(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  if (!isMarketingApplicationId(id)) redirect("/admin/applications?error=invalid");
  const returnTo = applicationReturnPath(formData, id);

  const result = await rejectBetaApplication(
    { id, reviewer: session.login },
    reviewDeps,
  );
  if (
    result.ok ||
    result.reason === "partial-reject" ||
    result.reason === "bootstrap"
  ) {
    await logReview(session, result, "admin.application-reject");
  }

  if (!result.ok) {
    redirect(withParam(returnTo, "error", result.reason));
  }

  revalidateApplications(id);
  redirect(withParam(returnTo, "rejected", "1"));
}

export async function revokeApplicationAccess(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  if (!isMarketingApplicationId(id)) redirect("/admin/applications?error=invalid");
  const returnTo = applicationReturnPath(formData, id);

  const result = await revokeBetaApplicationAccess({ id }, reviewDeps);
  if (result.ok) {
    await logReview(session, result, "admin.application-revoke");
  }

  if (!result.ok) {
    redirect(withParam(returnTo, "error", result.reason));
  }

  revalidateApplications(id);
  redirect(withParam(returnTo, "revoked", "1"));
}

export async function resendApplicationInvite(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  if (!isMarketingApplicationId(id)) redirect("/admin/applications?error=invalid");
  const returnTo = applicationReturnPath(formData, id);
  const loaded = await loadMarketingApplication(id);
  if (loaded.state !== "ok") {
    redirect(withParam(returnTo, "error", loaded.state));
  }
  const email = normalizeEmail(loaded.application.email);
  if (!email) redirect(withParam(returnTo, "error", "email"));
  if (loaded.application.status !== "approved") {
    redirect(withParam(returnTo, "error", "status"));
  }

  let delivery: "sent" | "skipped" | "failed";
  try {
    delivery = await sendApprovalEmail(email);
  } catch {
    delivery = "failed";
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.application-invite-resend",
    targetType: "marketingBetaApplication",
    targetId: id,
    metadata: { email, delivery },
  });
  revalidateApplications(id);
  const resentPath = withParam(returnTo, "resent", "1");
  redirect(withParam(resentPath, "invite", delivery));
}
