"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserAction } from "@/lib/admin/guard";
import { flashToast } from "@/lib/toast-server";
import type { ImportField, ImportFormState } from "@/lib/import/import-state";
import { importRepo, type ImportResult } from "@/lib/import/repo-import";
import { assertCredits } from "@/lib/credits/apply";
import { createPrismaImportStore } from "@/lib/import/prisma-import-store";

function failure(field: ImportField | "form", message: string): ImportFormState {
  return { error: { field, message } };
}

export async function importRepository(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const session = await requireUserAction();
  const repoId = String(formData.get("repoId") ?? "");
  const store = createPrismaImportStore();
  if (!store) return failure("form", "The database is not connected.");
  const credits = await assertCredits(session.userId);
  if (!credits.ok) return failure("form", credits.error);

  let result: ImportResult;
  try {
    result = await importRepo(store, {
      repoId,
      userId: session.userId,
      name: String(formData.get("name") ?? ""),
      subdomain: String(formData.get("subdomain") ?? ""),
      description: String(formData.get("description") ?? ""),
      theme: String(formData.get("theme") ?? "MINIMAL"),
      primaryColor: String(formData.get("primaryColor") ?? "#2A2AD6"),
      reviewMode: String(formData.get("reviewMode") ?? "AUTO_PUBLISH"),
    });
  } catch {
    return failure("form", "Could not start the build. Try again.");
  }

  if (result.status === "imported") {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    await flashToast("success", "Build queued. Your docs are being generated.");
    redirect(`/dashboard/sites/${result.siteId}`);
  }
  if (result.status === "already-imported") {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    await flashToast("info", "That repository is already imported.");
    redirect(`/dashboard/sites/${result.siteId}`);
  }

  switch (result.status) {
    case "invalid":
      return failure(result.field, result.message);
    case "subdomain-taken":
      return failure("subdomain", "That subdomain is already taken. Choose another.");
    case "not-found":
      return failure("form", "That repo is not available in the selected GitHub account.");
    case "unavailable":
      return failure("form", "That repo is archived or removed and cannot be imported.");
  }
}
