"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";

export async function retryJob(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/jobs?error=1");
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || job.status !== "FAILED") redirect("/admin/jobs?error=1");
  await prisma.job.update({
    where: { id },
    data: {
      status: "QUEUED",
      error: null,
      startedAt: null,
      finishedAt: null,
    },
  });
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.job-retry",
    targetType: "job",
    targetId: id,
    metadata: { kind: job.kind, repoId: job.repoId },
  });
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs?retried=1");
}
