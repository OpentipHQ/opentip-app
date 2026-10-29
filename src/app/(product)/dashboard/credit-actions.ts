"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestMoreCredits } from "@/lib/credits/apply";
import { getViewSession } from "@/lib/admin/act-as";
import { blockActAsWrites } from "@/lib/admin/guard";
import { redirectWithToast } from "@/lib/toast-server";

export async function requestMoreAction() {
  const session = await getViewSession();
  if (!session) redirect("/login?next=/dashboard/usage");
  await blockActAsWrites();
  const result = await requestMoreCredits(session.userId);
  revalidatePath("/dashboard/usage");
  revalidatePath("/admin/credits");
  if (!result.ok) {
    return redirectWithToast("/dashboard/usage", "error", result.error);
  }
  return redirectWithToast("/dashboard/usage", "success", "Request sent.");
}
