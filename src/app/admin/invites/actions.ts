"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { getPrisma } from "@/lib/db";
import { sendBetaInviteEmail } from "@/lib/email/resend";

export async function createBetaInvite(formData: FormData) {
  const session = await getRequestSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const waveValue = Number(formData.get("wave") ?? 1);
  const wave = Number.isFinite(waveValue) && waveValue > 0 ? Math.floor(waveValue) : 1;
  const prisma = getPrisma();
  if (!prisma || !email.includes("@")) redirect("/admin/invites?error=1");
  const token = randomBytes(24).toString("base64url");
  await prisma.betaInvite.create({ data: { email, wave, token } });
  try {
    const sent = await sendBetaInviteEmail({
      to: email,
      inviteUrl: `${appUrl()}/sign-in?invite=${token}`,
    });
    if (sent.delivered) {
      await prisma.betaInvite.updateMany({
        where: { token },
        data: { sentAt: new Date() },
      });
      redirect("/admin/invites?sent=1");
    }
  } catch {
    redirect("/admin/invites?saved=1");
  }
  redirect("/admin/invites?saved=1");
}
