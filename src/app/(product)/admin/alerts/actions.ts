"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { requireWritableAdminAction } from "@/lib/admin/guard";
import { runSpendAlerts } from "@/lib/admin/spend-check";
import { redirectWithToast } from "@/lib/toast-server";

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
  return redirectWithToast(
    `/admin/alerts?checked=1&total=${result.dailyTotal.toFixed(2)}&outliers=${result.outlierCount}`,
    "success",
    `Spend check complete. ${result.outlierCount} outliers found.`,
  );
}
