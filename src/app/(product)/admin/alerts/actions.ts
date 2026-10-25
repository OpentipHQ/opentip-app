"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { runSpendAlerts } from "@/lib/admin/spend-check";

export async function checkSpendAlerts() {
  const session = await requireWritableAdminAction();
  const result = await runSpendAlerts();
  await logActivity({
    actorId: session.userId,
    actorEmail: session.login,
    action: "admin.spend-alerts-check",
    targetType: "spendAlert",
    metadata: { ...result },
  });
  revalidatePath("/admin/alerts");
  redirect(
    `/admin/alerts?checked=1&total=${result.dailyTotal.toFixed(2)}&outliers=${result.outlierCount}`,
  );
}
