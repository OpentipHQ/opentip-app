"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";
import { filterAnnouncementRecipients } from "@/lib/email/preferences";
import { sendAnnouncementEmail } from "@/lib/email/resend";

async function sendToBetaUsers(announcement: {
  id: string;
  title: string;
  body: string;
}): Promise<{ sent: number; suppressed: number }> {
  const prisma = getPrisma();
  if (!prisma) return { sent: 0, suppressed: 0 };
  const rows = await prisma.betaAccess.findMany({ select: { email: true } });
  const emails = Array.from(new Set(rows.map((row) => row.email)));
  const { recipients, suppressed } = await filterAnnouncementRecipients(emails);
  let sent = 0;
  for (const email of recipients) {
    try {
      const result = await sendAnnouncementEmail({
        to: email,
        subject: announcement.title,
        body: announcement.body,
      });
      if (result.delivered) sent += 1;
    } catch {
      // Keep the announcement so the email can be retried.
    }
  }
  await prisma.announcement.update({
    where: { id: announcement.id },
    data: {
      emailSentAt: sent > 0 ? new Date() : null,
      emailRecipientCount: sent,
    },
  });
  return { sent, suppressed: suppressed.length };
}

export async function createAnnouncement(formData: FormData) {
  const session = await requireWritableAdminAction();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const active = formData.get("active") === "on";
  const email = formData.get("email") === "on";
  if (!title || !body) redirect("/admin/announcements?error=1");
  const prisma = getPrisma();
  if (!prisma) redirect("/admin/announcements?error=database");
  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      active,
      emailRequested: email,
      authorId: session.userId,
    },
  });
  let sent = 0;
  let suppressed = 0;
  if (email) {
    const result = await sendToBetaUsers(announcement);
    sent = result.sent;
    suppressed = result.suppressed;
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.announcement-create",
    targetType: "announcement",
    targetId: announcement.id,
    metadata: { title, active, email, sent, suppressed },
  });
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect(`/admin/announcements?saved=1&sent=${sent}`);
}

export async function toggleAnnouncement(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/announcements?error=1");
  const row = await prisma.announcement.findUnique({ where: { id } });
  if (!row) redirect("/admin/announcements?error=1");
  await prisma.announcement.update({ where: { id }, data: { active: !row.active } });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.announcement-toggle",
    targetType: "announcement",
    targetId: id,
    metadata: { active: !row.active },
  });
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?saved=toggle");
}

export async function resendAnnouncement(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/announcements?error=1");
  const row = await prisma.announcement.findUnique({ where: { id } });
  if (!row) redirect("/admin/announcements?error=1");
  const result = await sendToBetaUsers(row);
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.announcement-resend",
    targetType: "announcement",
    targetId: id,
    metadata: { sent: result.sent, suppressed: result.suppressed },
  });
  revalidatePath("/admin/announcements");
  redirect(`/admin/announcements?saved=resend&sent=${result.sent}`);
}
