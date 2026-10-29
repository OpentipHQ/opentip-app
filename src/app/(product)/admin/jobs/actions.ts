"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { getPrisma } from "@/lib/db";
import { redirectWithToast } from "@/lib/toast-server";
import { retryFailedJob } from "@/worker/queue";

export async function retryJob(formData: FormData) {
  const session = await requireWritableAdminAction();
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) {
    return redirectWithToast("/admin/jobs?error=1", "error", "That job could not be retried.");
  }
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || job.status !== "FAILED") {
    return redirectWithToast(
      "/admin/jobs?error=1",
      "error",
      "Only failed jobs can be retried.",
    );
  }
  const retried = await retryFailedJob(id);
  if (!retried) {
    return redirectWithToast(
      "/admin/jobs?error=1",
      "error",
      "Could not queue that job. Try again.",
    );
  }
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.job-retry",
    targetType: "job",
    targetId: id,
    metadata: { kind: job.kind, repoId: job.repoId },
  });
  revalidatePath("/admin/jobs");
  return redirectWithToast("/admin/jobs?retried=1", "success", "Job queued again.");
}
