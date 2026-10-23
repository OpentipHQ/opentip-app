"use server";

import { redirect } from "next/navigation";
import { getRequestSession } from "@/lib/auth";
import { grantBetaAccess } from "@/lib/beta/access";
import { getPrisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/login-code";

export async function approveApplication(formData: FormData) {
  const session = await getRequestSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");
  const id = String(formData.get("id") ?? "");
  const prisma = getPrisma();
  if (!prisma || !id) redirect("/admin/applications?error=1");
  const application = await prisma.betaApplication.findUnique({ where: { id } });
  const email = normalizeEmail(application?.email);
  if (!application || !email) redirect("/admin/applications?error=1");
  await grantBetaAccess(email, application.id);
  await prisma.betaApplication.update({
    where: { id: application.id },
    data: { status: "approved" },
  });
  redirect("/admin/applications?approved=1");
}
