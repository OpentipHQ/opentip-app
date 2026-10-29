"use server";

import { randomBytes } from "node:crypto";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { grantBetaAccess } from "@/lib/beta/access";
import { appUrl } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/login-code";
import { sendBetaInviteEmail } from "@/lib/email/resend";
import { redirectWithToast } from "@/lib/toast-server";

export async function createBetaInvite(formData: FormData) {
  const session = await requireWritableAdminAction();
  const raw = String(formData.get("emails") ?? formData.get("email") ?? "");
  const emails = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((value) => normalizeEmail(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const waveValue = Number(formData.get("wave") ?? 1);
  const wave = Number.isFinite(waveValue) && waveValue > 0 ? Math.floor(waveValue) : 1;
  const prisma = getPrisma();
  if (!prisma) {
    return redirectWithToast(
      "/admin/invites?error=invalid",
      "error",
      "The database is not connected.",
    );
  }
  if (emails.length === 0) {
    return redirectWithToast(
      "/admin/invites?error=invalid",
      "error",
      "Add at least one valid email.",
    );
  }
  if (emails.length > 50) {
    return redirectWithToast(
      "/admin/invites?error=limit",
      "error",
      "Send at most 50 emails per wave.",
    );
  }

  let sent = 0;
  let saved = 0;
  for (const email of emails) {
    const token = randomBytes(24).toString("base64url");
    await prisma.betaInvite.create({ data: { email, wave, token } });
    await grantBetaAccess(email);
    saved += 1;
    try {
      const result = await sendBetaInviteEmail({
        to: email,
        inviteUrl: `${appUrl()}/login?invite=${token}`,
      });
      if (result.delivered) {
        await prisma.betaInvite.updateMany({
          where: { token },
          data: { sentAt: new Date() },
        });
        sent += 1;
      }
    } catch {
      // Keep the invite row so the wave can be retried.
    }
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.invite-wave",
    targetType: "betaInvite",
    metadata: { wave, emails: emails.length, sent, saved },
  });
  return redirectWithToast(
    `/admin/invites?saved=${saved}&sent=${sent}&wave=${wave}`,
    "success",
    `${saved} invites saved. ${sent} emails sent.`,
  );
}
